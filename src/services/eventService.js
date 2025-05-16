const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class EventService {
    // Create a new session
    async createSession(sessionData) {
        try {
            const sessionId = uuidv4();
            const { data, error } = await supabase
                .from('sessions')
                .insert([{
                    id: sessionId,
                    school_id: sessionData.schoolId,
                    classroom_id: sessionData.classroomId,
                    quiz_id: sessionData.quizId,
                    created_by: sessionData.userId,
                    status: 'ACTIVE',
                    started_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error creating session:', error);
            throw error;
        }
    }

    // End a session
    async endSession(sessionId) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .update({
                    status: 'COMPLETED',
                    ended_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error ending session:', error);
            throw error;
        }
    }

    // Track event with automatic session management
    async trackEvent(eventData) {
        try {
            let sessionId = eventData?.sessionId;

            // If this is a QUIZ_START event, create a new session
            if (eventData.eventType === 'QUIZ_START' && !sessionId) {
                const session = await this.createSession({
                    schoolId: eventData.schoolId,
                    classroomId: eventData.classroomId,
                    quizId: eventData.metadata?.quizId,
                    userId: eventData.userId
                });
                sessionId = session.id;
            }

            // If this is a QUIZ_END event, end the session
            if (eventData.eventType === 'QUIZ_END' && sessionId) {
                await this.endSession(sessionId);
            }

            const { data, error } = await supabase
                .from('events')
                .insert([{
                    event_type: eventData.eventType,
                    app_type: eventData.appType,
                    user_id: eventData.userId,
                    user_role: eventData.userRole,
                    school_id: eventData.schoolId,
                    classroom_id: eventData.classroomId,
                    session_id: sessionId,
                    metadata: eventData.metadata || {},
                    timestamp: eventData.timestamp || new Date().toISOString()
                }])
                .select();

            if (error) throw error;
            return data[0];
        } catch (error) {
            logger.error('Error tracking event:', error);
            throw error;
        }
    }

    // Get events by session ID
    async getEventsBySession(sessionId) {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error getting events by session:', error);
            throw error;
        }
    }

    // Get active sessions for a classroom
    async getActiveSessions(classroomId) {
        try {
            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .eq('classroom_id', classroomId)
                .eq('status', 'ACTIVE')
                .order('started_at', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error getting active sessions:', error);
            throw error;
        }
    }

    async getEvents(filters = {}) {
        try {
            let query = supabase
                .from('events')
                .select('*');

            // Apply filters
            if (filters.eventType) {
                query = query.eq('event_type', filters.eventType);
            }
            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters.schoolId) {
                query = query.eq('school_id', filters.schoolId);
            }
            if (filters.classroomId) {
                query = query.eq('classroom_id', filters.classroomId);
            }
            if (filters.sessionId) {
                query = query.eq('session_id', filters.sessionId);
            }
            if (filters.startDate && filters.endDate) {
                query = query
                    .gte('timestamp', filters.startDate)
                    .lte('timestamp', filters.endDate);
            }

            const { data, error } = await query
                .order('timestamp', { ascending: false });

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    }

    async getQuizEvents(classroomId, quizId, userId = null) {
        try {
            let query = supabase
                .from('events')
                .select('*')
                .eq('classroom_id', classroomId)
                .eq('metadata->>quizId', quizId)
                .order('timestamp', { ascending: true });
            if (userId) {
                query = query.eq('user_id', userId);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Error fetching quiz events:', error);
            throw error;
        }
    }

    async getStudentPerformanceReport({ classroomId, quizId, userId }) {
        // Fetch all QUIZ_ANSWER events for this quiz/classroom/user
        let query = supabase
            .from('events')
            .select('*')
            .eq('event_type', 'QUIZ_ANSWER_SUBMITTED')
            .eq('classroom_id', classroomId)
            .eq('metadata->>quizId', quizId);
        if (userId) query = query.eq('user_id', userId);
        const { data, error } = await query;

        console.log("xx", data)
        if (error) throw error;
        // Aggregate stats
        const total = data.length;
        const correct = data.filter(e => e.metadata.isCorrect).length;
        const avgTime = data.reduce((sum, e) => sum + (e.metadata.timeTaken || 0), 0) / (total || 1);
        return { total, correct, avgTime };
    }

    async getClassroomEngagementReport({ classroomId, quizId, startDate, endDate }) {
        // Participation: number of students who started, finished, and answered at least one question
        // Engagement: answer rates, etc.
        let filters = { classroomId };
        if (quizId) filters.quizId = quizId;
        if (startDate && endDate) {
            filters.startDate = startDate;
            filters.endDate = endDate;
        }
        // Get all QUIZ_ATTEMPT_STARTED and QUIZ_ATTEMPT_COMPLETED events
        const started = await this.getEvents({ ...filters, eventType: 'QUIZ_ATTEMPT_STARTED' });
        const finished = await this.getEvents({ ...filters, eventType: 'QUIZ_ATTEMPT_COMPLETED' });
        // Get all QUIZ_ANSWER_SUBMITTED events
        const answers = await this.getEvents({ ...filters, eventType: 'QUIZ_ANSWER_SUBMITTED' });
        // Unique students
        const studentsStarted = new Set(started.map(e => e.user_id));
        const studentsFinished = new Set(finished.map(e => e.user_id));
        const studentsAnswered = new Set(answers.map(e => e.user_id));
        return {
            studentsStarted: studentsStarted.size,
            studentsFinished: studentsFinished.size,
            studentsAnswered: studentsAnswered.size,
            totalAnswers: answers.length,
            participationRate: studentsStarted.size > 0 ? (studentsAnswered.size / studentsStarted.size) : 0
        };
    }

    async getContentEffectivenessReport({ quizId }) {
        // For each question: number of answers, % correct, avg time
        // Get all QUIZ_ANSWER_SUBMITTED events for this quiz
        const answers = await this.getEvents({ eventType: 'QUIZ_ANSWER_SUBMITTED' });
        // Filter for this quiz
        const filtered = answers.filter(e => e.metadata.quizId === quizId);
        // Group by questionId
        const byQuestion = {};
        for (const e of filtered) {
            const qid = e.metadata.questionId;
            if (!byQuestion[qid]) byQuestion[qid] = [];
            byQuestion[qid].push(e);
        }
        // Aggregate
        const result = [];
        for (const [questionId, events] of Object.entries(byQuestion)) {
            const total = events.length;
            const correct = events.filter(e => e.metadata.isCorrect).length;
            const avgTime = events.reduce((sum, e) => sum + (e.metadata.timeTaken || 0), 0) / (total || 1);
            result.push({
                questionId,
                totalAnswers: total,
                percentCorrect: total > 0 ? (correct / total) * 100 : 0,
                avgTime
            });
        }
        return result;
    }
}

module.exports = new EventService(); 