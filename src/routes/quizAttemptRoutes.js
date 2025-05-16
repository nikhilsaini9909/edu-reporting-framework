module.exports = (wsHandler) => {
const express = require('express');
const router = express.Router();
const quizAttemptService = require('../services/quizAttemptService');
const { verifyToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const eventService = require('../services/eventService');
const studentResponseService = require('../services/studentResponseService');

// Start a new quiz attempt
router.post('/:quizId/start', verifyToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { schoolId, classroomId } = req.body;
    const studentId = req.user.id;

    if (!schoolId || !classroomId) {
      return res.status(400).json({ 
        success: false, 
        error: 'schoolId and classroomId are required' 
      });
    }

    const session = await quizAttemptService.startQuizAttempt(studentId, quizId, schoolId, classroomId);

    // Track quiz start event
    await eventService.trackEvent({
      eventType: 'QUIZ_ATTEMPT_STARTED',
      appType: 'NOTEBOOK',
      userId: studentId,
      userRole: 'student',
      schoolId,
      classroomId,
      sessionId: session.id,
      metadata: { 
        quizId,
        startTime: new Date().toISOString()
      }
    });

    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Start quiz session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit an answer for a question
router.post('/sessions/questions/:questionId/answer', verifyToken, async (req, res) => {
  try {
    const { sessionId, questionId } = req.params;
    const { answer_id, timeTaken } = req.body;
    const studentId = req.user.id;

    if (req.user.role!=="student"){
      return res.status(400).json({ success: false, error: 'Only students can answer' });
    }

    if (!answer_id && answer_id !== 0) {
      return res.status(400).json({ success: false, error: 'Answer is required' });
    }

    const savedResponse = await studentResponseService.submitResponse({
      questionId,
      studentId,
      answer_id,
      timeTaken,
    });

    // Track answer submission event
    await eventService.trackEvent({
      eventType: 'QUIZ_ANSWER_SUBMITTED',
      appType: 'NOTEBOOK',
      userId: studentId,
      userRole: 'student',
      sessionId,
      metadata: {
        questionId,
        answer_id,
        is_correct: savedResponse.is_correct,
        timeTaken,
        classroomId: savedResponse.classroom_id,
        quizid: savedResponse.quizid
      }
    });

    // WebSocket: Notify teacher in real time
    if (wsHandler && savedResponse.classroom_id) {
      wsHandler.broadcastToRoom(savedResponse.classroom_id, {
        type: 'NEW_ANSWER',
        sessionId,
        questionId,
        userId: studentId,
        answer_id,
        is_correct: savedResponse.is_correct,
        timeTaken,
        classroomId: savedResponse.classroom_id,
        quizid: savedResponse.quizid
      });
    }

    res.json({ success: true, data: savedResponse });
  } catch (error) {
    logger.error('Submit answer error:', error);
    if (error.message === 'Session is not active') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Finish a quiz session
router.post('/sessions/:sessionId/finish', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const studentId = req.user.id;
    
    const session = await quizAttemptService.finishQuizAttempt(sessionId);

    // Get quiz report for the session
    const quizReport = await studentResponseService.getStudentQuizReport(
      studentId,
      session.quiz_id,
      sessionId
    );

    // Track quiz completion event
    await eventService.trackEvent({
      eventType: 'QUIZ_ATTEMPT_COMPLETED',
      appType: 'NOTEBOOK',
      userId: studentId,
      userRole: 'student',
      sessionId,
      metadata: {
        quizId: session.quiz_id,
        totalQuestions: quizReport.length,
        correctAnswers: quizReport.filter(r => r.is_correct).length,
        completionTime: new Date().toISOString()
      }
    });

    // WebSocket: Notify teacher in real time
    if (wsHandler && session.classroom_id) {
      wsHandler.broadcastToRoom(session.classroom_id, {
        type: 'QUIZ_ATTEMPT_COMPLETED',
        sessionId,
        userId: studentId,
        quizId: session.quiz_id,
        stats: {
          totalQuestions: quizReport.length,
          correctAnswers: quizReport.filter(r => r.is_correct).length
        }
      });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Finish quiz session error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

return router;
}
