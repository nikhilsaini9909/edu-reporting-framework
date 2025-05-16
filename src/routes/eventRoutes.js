const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Track new event
router.post('/', verifyToken, async (req, res) => {
    try {
        const eventData = {
            ...req.body,
            userId: req.user.id,
            userRole: req.user.role.toUpperCase()
        };

        const event = await eventService.trackEvent(eventData);
        res.status(201).json({
            success: true,
            data: event
        });
    } catch (error) {
        logger.error('Event tracking error:', error);
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get events with filters
router.get('/', verifyToken, async (req, res) => {
    try {
        const filters = {
            eventType: req.query.eventType,
            userId: req.query.userId,
            schoolId: req.query.schoolId,
            classroomId: req.query.classroomId,
            sessionId: req.query.sessionId,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        // Only allow admins to view all events
        if (req.user.role !== 'admin') {
            filters.schoolId = req.user.schoolId;
        }

        const events = await eventService.getEvents(filters);
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        logger.error('Event retrieval error:', error);
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get events by session ID
router.get('/session/:sessionId', verifyToken, async (req, res) => {
    try {
        const events = await eventService.getEventsBySession(req.params.sessionId);
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        logger.error('Session events retrieval error:', error);
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get active sessions for a classroom
router.get('/sessions/active/:classroomId', verifyToken, async (req, res) => {
    try {
        const sessions = await eventService.getActiveSessions(req.params.classroomId);
        res.json({
            success: true,
            data: sessions
        });
    } catch (error) {
        logger.error('Active sessions retrieval error:', error);
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Get quiz-specific events
router.get('/quiz/:classroomId/:quizId', verifyToken, async (req, res) => {
    try {
        const { classroomId, quizId } = req.params;
        const userId = req.query.userId || null;
        
        // Verify user has access to this classroom
        if (req.user.role !== 'admin' && req.user.schoolId !== req.query.schoolId) {
            return res.status(403).json({
                success: false,
                error: { message: 'Access denied to this classroom' }
            });
        }

        const events = await eventService.getQuizEvents(classroomId, quizId, userId);
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        logger.error('Quiz event retrieval error:', error);
        res.status(400).json({
            success: false,
            error: { message: error.message }
        });
    }
});

// Student/classroom performance report
router.get('/reports/performance/:classroomId/:quizId/:userId?', verifyToken, async (req, res) => {
    try {
        const { classroomId, quizId, userId } = req.params;
        console.log("comgin in api")
        const report = await eventService.getStudentPerformanceReport({ classroomId, quizId, userId });
        res.json({ success: true, data: report });
    } catch (error) {
        logger.error('Performance report error:', error);
        res.status(400).json({ success: false, error: { message: error.message } });
    }
});

// Classroom engagement metrics
router.get('/reports/engagement', verifyToken, async (req, res) => {
    try {
        const { classroomId, quizId, startDate, endDate } = req.query;
        const engagement = await eventService.getClassroomEngagementReport({ classroomId, quizId, startDate, endDate });
        res.json({ success: true, data: engagement });
    } catch (error) {
        logger.error('Engagement report error:', error);
        res.status(400).json({ success: false, error: { message: error.message } });
    }
});

// Content effectiveness evaluation
router.get('/reports/content-effectiveness', verifyToken, async (req, res) => {
    try {
        const { quizId } = req.query;
        const effectiveness = await eventService.getContentEffectivenessReport({ quizId });
        res.json({ success: true, data: effectiveness });
    } catch (error) {
        logger.error('Content effectiveness report error:', error);
        res.status(400).json({ success: false, error: { message: error.message } });
    }
});

module.exports = router; 