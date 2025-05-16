const logger = require('../utils/logger');
const eventService = require('../services/eventService');
const jwt = require('jsonwebtoken');

class WebSocketHandler {
    constructor(wss) {
        this.wss = wss;
        this.rooms = new Map(); // Map of classroomId -> Set of connected clients
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', async (ws, req) => {
            try {
                // Authenticate the connection
                const token = this.extractToken(req);
                if (!token) {
                    ws.close(1008, 'Authentication required');
                    return;
                }

                const user = this.verifyToken(token);
                if (!user) {
                    ws.close(1008, 'Invalid token');
                    return;
                }

                ws.user = user;
                logger.info(`New WebSocket connection established for user ${user.id}`);

                ws.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        await this.handleMessage(ws, data);
                    } catch (error) {
                        logger.error('WebSocket message handling error:', error);
                        this.sendError(ws, 'Invalid message format');
                    }
                });

                ws.on('close', () => {
                    this.handleDisconnect(ws);
                });

                ws.on('error', (error) => {
                    logger.error('WebSocket error:', error);
                });

                // Set up ping-pong for connection health check
                ws.isAlive = true;
                ws.on('pong', () => {
                    ws.isAlive = true;
                });

            } catch (error) {
                logger.error('WebSocket connection error:', error);
                ws.close(1011, 'Internal server error');
            }
        });

        // Heartbeat to keep connections alive
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(interval);
        });
    }

    extractToken(req) {
        const url = new URL(req.url, 'ws://localhost');
        return url.searchParams.get('token');
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    async handleMessage(ws, data) {
        switch (data.type) {
            case 'JOIN_CLASSROOM':
                await this.handleJoinClassroom(ws, data);
                break;
            case 'QUIZ_START':
                await this.handleQuizStart(ws, data);
                break;
            case 'QUIZ_ANSWER':
                await this.handleQuizAnswer(ws, data);
                break;
            case 'QUIZ_END':
                await this.handleQuizEnd(ws, data);
                break;
            default:
                logger.warn('Unknown message type:', data.type);
                this.sendError(ws, 'Unknown message type');
        }
    }

    async handleJoinClassroom(ws, data) {
        const { classroomId } = data;

        console.log("school->", ws.user.schoolId, "data", data.schoolId)
        
        // Verify user has access to this classroom
        if (ws.user.role !== 'admin' && ws.user.schoolId !== data.schoolId) {
            this.sendError(ws, 'Access denied to this classroom');
            return;
        }

        // Add client to room
        if (!this.rooms.has(classroomId)) {
            this.rooms.set(classroomId, new Set());
        }
        this.rooms.get(classroomId).add(ws);
        ws.classroomId = classroomId;

        // Track join event
        await eventService.trackEvent({
            eventType: 'CLASSROOM_JOIN',
            appType: ws.user.role === 'teacher' ? 'WHITEBOARD' : 'NOTEBOOK',
            userId: ws.user.id,
            userRole: ws.user.role,
            schoolId: data.schoolId,
            classroomId,
            metadata: { timestamp: new Date().toISOString() }
        });

        this.broadcastToRoom(classroomId, {
            type: 'USER_JOINED',
            userId: ws.user.id,
            userRole: ws.user.role
        });
    }

    async handleQuizStart(ws, data) {
        if (ws.user.role !== 'teacher' && ws.user.role !== 'admin') {
            this.sendError(ws, 'Only teachers can start quizzes');
            return;
        }

        const { classroomId, quizId, sessionId } = data;

        // Broadcast quiz start to all students in the classroom
        this.broadcastToRoom(classroomId, {
            type: 'QUIZ_STARTED',
            quizId,
            sessionId,
            metadata: data.metadata
        });

        // Track the event
        await eventService.trackEvent({
            eventType: 'QUIZ_START',
            appType: 'WHITEBOARD',
            userId: ws.user.id,
            userRole: ws.user.role,
            schoolId: data.schoolId,
            classroomId,
            sessionId,
            metadata: {
                quizId,
                ...data.metadata
            }
        });
    }

    async handleQuizAnswer(ws, data) {
        if (ws.user.role !== 'student') {
            this.sendError(ws, 'Only students can submit answers');
            return;
        }

        const { classroomId, quizId, questionId, answer, isCorrect, timeTaken } = data;
        
        // Track answer event
        await eventService.trackEvent({
            eventType: 'QUIZ_ANSWER',
            appType: 'NOTEBOOK',
            userId: ws.user.id,
            userRole: ws.user.role,
            schoolId: data.schoolId,
            classroomId,
            metadata: { quizId, questionId, answer, isCorrect, timeTaken }
        });

        // Notify teacher of new answer
        this.broadcastToRoom(classroomId, {
            type: 'NEW_ANSWER',
            quizId,
            questionId,
            userId: ws.user.id,
            answer,
            isCorrect,
            timeTaken
        });

        // Get and broadcast updated quiz statistics
        const quizReport = await eventService.getStudentPerformanceReport({
            classroomId,
            quizId
        });

        this.broadcastToRoom(classroomId, {
            type: 'QUIZ_STATS_UPDATE',
            quizId,
            stats: quizReport
        });
    }

    async handleQuizEnd(ws, data) {
        if (ws.user.role !== 'teacher' && ws.user.role !== 'admin') {
            this.sendError(ws, 'Only teachers can end quizzes');
            return;
        }

        const { classroomId, quizId, sessionId } = data;

        // Broadcast quiz end to all students in the classroom
        this.broadcastToRoom(classroomId, {
            type: 'QUIZ_ENDED',
            quizId,
            sessionId
        });

        // Track the event
        await eventService.trackEvent({
            eventType: 'QUIZ_END',
            appType: 'WHITEBOARD',
            userId: ws.user.id,
            userRole: ws.user.role,
            schoolId: data.schoolId,
            classroomId,
            sessionId,
            metadata: {
                quizId
            }
        });

        // Get and broadcast final quiz statistics
        const quizStats = await eventService.getStudentPerformanceReport({
            classroomId,
            quizId
        });

        this.broadcastToRoom(classroomId, {
            type: 'QUIZ_FINAL_STATS',
            quizId,
            stats: quizStats
        });
    }

    handleDisconnect(ws) {
        if (ws.classroomId) {
            const room = this.rooms.get(ws.classroomId);
            if (room) {
                room.delete(ws);
                if (room.size === 0) {
                    this.rooms.delete(ws.classroomId);
                } else {
                    this.broadcastToRoom(ws.classroomId, {
                        type: 'USER_LEFT',
                        userId: ws.user.id,
                        userRole: ws.user.role
                    });
                }
            }
        }
        logger.info(`Client disconnected: ${ws.user.id}`);
    }

    broadcastToRoom(classroomId, message) {
        console.log("check in broadcast")
        const room = this.rooms.get(classroomId);
        if (room) {
            console.log("check inside broadcast")
            const messageStr = JSON.stringify(message);
            room.forEach(client => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(messageStr);
                }
            });
        }
    }

    sendError(ws, message) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            message
        }));
    }
}

module.exports = WebSocketHandler; 