module.exports = (wsHandler) => {
const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const QuestionService = require('../services/questionService');
const logger = require('../utils/logger');
const eventService = require('../services/eventService');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
// You may want to create a QuizService for more complex logic, but for now, we'll use Supabase directly here
const questionService = new QuestionService();

// Create a quiz
router.post('/', verifyToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { classroom_id, title, description, questions } = req.body;
    const { id: created_by } = req.user;

    console.log("classroom_id", classroom_id)

    // First verify the classroom exists
    const { data: classroom, error: classroomError } = await supabaseAdmin
      .from('classrooms')
      .select('id, school_id')
      .eq('id', classroom_id)
      .single();

      console.log("clas=>", classroom, "claserro", classroomError)

    if (classroomError || !classroom) {
      return res.status(400).json({
        success: false,
        error: { message: 'Classroom not found' }
      });
    }

    // Check user role and get appropriate ID
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', created_by)
      .single();

    if (roleError || !userRole) {
      return res.status(400).json({
        success: false,
        error: { message: 'User role not found' }
      });
    }

    let creator_id = null;

    if (userRole.role === 'admin') {
      // For admin, use their auth user ID directly
      creator_id = created_by;
    } else {
      // For teacher, get their teacher ID
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('user_id', created_by)
        .single();

      if (teacherError || !teacher) {
        return res.status(400).json({
          success: false,
          error: { message: 'Teacher profile not found' }
        });
      }
      creator_id = teacher.id;
    }

    // Create the quiz
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .insert([{
        id: uuidv4(),
        classroom_id,
        title,
        description,
        created_by: creator_id,
        is_active: true
      }])
      .select()
      .single();

    if (quizError) {
      logger.error('Create quiz error:', quizError);
      return res.status(400).json({
        success: false,
        error: { message: quizError.message }
      });
    }

    let insertedQuestions = [];
    
    // Only insert questions if they are provided
    if (questions && Array.isArray(questions) && questions.length > 0) {
      const questionsToInsert = questions.map((q, index) => ({
        id: uuidv4(),
        quiz_id: quiz.id,
        question_text: q.question_text,
        question_type: 'MULTIPLE_CHOICE',
        options: q.options,
        correct_answer_id: q.options.find(opt => opt.is_correct)?.id,
        points: q.points || 1,
        order_index: q.order_index || index + 1
      }));

      const { data: questionsData, error: questionsError } = await supabaseAdmin
        .from('quiz_questions')
        .insert(questionsToInsert)
        .select();

      if (questionsError) {
        logger.error('Create questions error:', questionsError);
        return res.status(400).json({
          success: false,
          error: { message: questionsError.message }
        });
      }

      insertedQuestions = questionsData;
    }

    // Track quiz creation event
    await eventService.trackEvent({
      eventType: 'QUIZ_CREATED',
      appType: 'WHITEBOARD',
      userId: created_by,
      userRole: userRole.role,
      schoolId: classroom.school_id,
      classroomId: classroom_id,
      metadata: { 
        quizId: quiz.id,
        title,
        description,
        questionCount: insertedQuestions.length
      }
    });

    res.status(201).json({ 
      success: true, 
      data: {
        ...quiz,
        questions: insertedQuestions
      }
    });
  } catch (error) {
    logger.error('Create quiz error:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// List quizzes (optionally by classroom)
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = supabase.from('quizzes').select('*');
    if (req.query.classroom_id) {
      query = query.eq('classroom_id', req.query.classroom_id);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    logger.error('List quizzes error:', error);
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

// Add a question to a quiz
router.post('/:quizId/questions', verifyToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const questionData = req.body;
    const question = await questionService.createQuestion(quizId, questionData);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    logger.error('Add question error:', error);
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

// List questions for a quiz
router.get('/:quizId/questions', verifyToken, async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const questions = await questionService.getQuestionsByQuiz(quizId);
    res.json({ success: true, data: questions });
  } catch (error) {
    logger.error('List questions error:', error);
    res.status(400).json({ success: false, error: { message: error.message } });
  }
});

// Start a quiz session (Teacher only)
router.post('/:quizId/start', verifyToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { classroomId } = req.body;
    const userId = req.user.id;

    // Get quiz details
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .select('*, classroom:classrooms(school_id)')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz not found' }
      });
    }

    console.log("quidata", quiz)
    const classroomIdToUse = classroomId || quiz.classroom_id;
    // Create a new session
    const session = await eventService.createSession({
      schoolId: quiz.classroom.school_id,
      classroomId: classroomIdToUse,
      quizId: quizId,
      userId: userId
    });

    // Track quiz start event
    await eventService.trackEvent({
      eventType: 'QUIZ_START',
      appType: 'WHITEBOARD',
      userId: userId,
      userRole: req.user.role,
      schoolId: quiz.classroom.school_id,
      classroomId: classroomId,
      sessionId: session.id,
      metadata: {
        quizId: quizId,
        title: quiz.title,
        description: quiz.description
      }
    });

    if (wsHandler) {
      wsHandler.broadcastToRoom(classroomIdToUse, {
        type: 'QUIZ_STARTED',
        quizId: quizId,
        sessionId: session.id,
        metadata: {
          title: quiz.title,
          description: quiz.description
        }
      });
    }

    res.json({
      success: true,
      data: {
        session,
        quiz
      }
    });
  } catch (error) {
    logger.error('Start quiz error:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

// End a quiz session (Teacher only)
router.post('/:quizId/end', verifyToken, checkRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { sessionId } = req.body;
    const userId = req.user.id;

    // Get quiz details
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .select('*, classroom:classrooms(school_id)')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quiz not found' }
      });
    }

    // End the session
    const session = await eventService.endSession(sessionId);

    // Track quiz end event
    await eventService.trackEvent({
      eventType: 'QUIZ_END',
      appType: 'WHITEBOARD',
      userId: userId,
      userRole: req.user.role,
      schoolId: quiz.classroom.school_id,
      classroomId: quiz.classroom_id,
      sessionId: sessionId,
      metadata: {
        quizId: quizId
      }
    });

    // Get final quiz statistics
    const quizStats = await eventService.getStudentPerformanceReport({
      classroomId: quiz.classroom_id,
      quizId: quizId
    });

    // Broadcast quiz end to all students in the classroom
    // This will be handled by the WebSocket server

    res.json({
      success: true,
      data: {
        session,
        stats: quizStats
      }
    });
  } catch (error) {
    logger.error('End quiz error:', error);
    res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
});

return router;
} 