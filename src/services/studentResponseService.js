const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

class StudentResponseService {
  async submitResponse({ questionId, studentId, answer_id, timeTaken }) {
    try {
      const { data: userData } = await supabaseAdmin
        .from('students')
        .select('classroom_id, school_id')
        .eq('user_id', studentId)
        .single();

      const { data: quizData, error: quizError } = await supabaseAdmin
        .from('quiz_questions')
        .select('quiz_id, correct_answer_id')
        .eq('id', questionId)
        .single();
      if (quizError) throw quizError;

      // Check if the answer is correct
      const isCorrect = answer_id === quizData.correct_answer_id;

      // Check if response already exists
      const { data: existingResponse } = await supabase
        .from('student_quiz_responses')
        .select('id')
        .eq('question_id', questionId)
        .eq('student_id', studentId)
        .single();

      let response;
      if (existingResponse) {
        // Update existing response
        const { data, error } = await supabase
          .from('student_quiz_responses')
          .update({
            answer_id: answer_id,
            is_correct: isCorrect,
            time_taken: timeTaken
          })
          .eq('id', existingResponse.id)
          .select()
          .single();

        if (error) throw error;
        response = data;
      } else {
        // Create new response
        const { data, error } = await supabase
          .from('student_quiz_responses')
          .insert([{
            question_id: questionId,
            student_id: studentId,
            answer_id: answer_id,
            is_correct: isCorrect,
            time_taken: timeTaken,
            classroom_id: userData.classroom_id,
            school_id: userData.school_id
          }])
          .select()
          .single();

        if (error) throw error;
        response = data;
      }
      response["quizid"] = quizData.quiz_id
      return response;
    } catch (error) {
      logger.error('Error submitting response:', error);
      throw error;
    }
  }

  async getResponsesByQuiz(quizId, sessionId = null) {
    try {
      let query = supabase
        .from('student_quiz_responses')
        .select(`
          *,
          questions!inner(*),
          answers(*)
        `)
        .eq('questions.quiz_id', quizId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting responses by quiz:', error);
      throw error;
    }
  }

  async getStudentQuizReport(studentId, quizId, sessionId = null) {
    try {
      let query = supabase
        .from('student_quiz_responses')
        .select(`
          *,
          questions!inner(*),
          answers(*)
        `)
        .eq('student_id', studentId)
        .eq('questions.quiz_id', quizId);

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting student quiz report:', error);
      throw error;
    }
  }

  async getQuizReport(quizId, sessionId = null) {
    try {
      const responses = await this.getResponsesByQuiz(quizId, sessionId);
      const total = responses.length;
      const correct = responses.filter(r => r.is_correct).length;
      const avgTime = responses.reduce((sum, r) => sum + (r.time_taken || 0), 0) / (total || 1);
      return { total, correct, avgTime };
    } catch (error) {
      logger.error('Error getting quiz report:', error);
      throw error;
    }
  }
}

module.exports = new StudentResponseService(); 