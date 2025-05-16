const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class QuizAttemptService {
  async startQuizAttempt(studentId, quizId, schoolId, classroomId) {
    try {
      // Check if there's an active quiz session for this classroom
      const { data: activeSession, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('classroom_id', classroomId)
        .eq('quiz_id', quizId)
        .eq('status', 'ACTIVE')
        .single();

      if (sessionError || !activeSession) {
        throw new Error('No active quiz session found for this classroom');
      }

      const sessionData = {
        id: uuidv4(),
        school_id: schoolId,
        classroom_id: classroomId,
        quiz_id: quizId,
        created_by: studentId,
        status: 'ACTIVE',
        started_at: new Date().toISOString()
      };

      const { data: session, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;
      return session;
    } catch (error) {
      logger.error('Error starting quiz session:', error);
      throw error;
    }
  }

  async submitAnswer(sessionId, questionId, answer_id, timeTaken) {
    try {
      // First, get the session to verify it's active
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('created_by, status, quiz:quizzes(classroom_id)')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;
      if (session.status !== 'ACTIVE') {
        throw new Error('Session is not active');
      }

      // Check if the quiz session is still active
      const { data: quizSession, error: quizSessionError } = await supabase
        .from('sessions')
        .select('status')
        .eq('classroom_id', session.quiz.classroom_id)
        .eq('quiz_id', session.quiz_id)
        .eq('status', 'ACTIVE')
        .single();

      if (quizSessionError || !quizSession) {
        throw new Error('Quiz session has ended');
      }

      // Get the question to check the answer
      const { data: question, error: questionError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (questionError) throw questionError;

      // Check if the answer is correct (MCQ only)
      const isCorrect = this.checkAnswer(question, answer_id);

      // Save the response
      const responseData = {
        id: uuidv4(),
        session_id: sessionId,
        question_id: questionId,
        student_id: session.created_by,
        answer_id: answer_id,
        is_correct: isCorrect,
        time_taken: timeTaken || 0
      };

      const { data: savedResponse, error } = await supabase
        .from('student_quiz_responses')
        .insert([responseData])
        .select()
        .single();

      if (error) throw error;
      return savedResponse;
    } catch (error) {
      logger.error('Error submitting answer:', error);
      throw error;
    }
  }

  checkAnswer(question, answer_id) {
    // For multiple choice, compare answer_id to correct_answer_id
    return answer_id === question.correct_answer_id;
  }

  async finishQuizAttempt(sessionId) {
    try {
      // Calculate final score
      const { data: responses, error: responsesError } = await supabase
        .from('student_quiz_responses')
        .select('is_correct')
        .eq('session_id', sessionId);

      if (responsesError) throw responsesError;

      const correctAnswers = responses.filter(r => r.is_correct).length;
      const totalQuestions = responses.length;

      // Update the session
      const { data: session, error } = await supabase
        .from('sessions')
        .update({
          status: 'COMPLETED',
          ended_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return session;
    } catch (error) {
      logger.error('Error finishing quiz attempt:', error);
      throw error;
    }
  }
}

module.exports = new QuizAttemptService();
