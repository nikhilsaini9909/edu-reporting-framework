const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const uuidv4 = require('uuid').v4;

// Only support MULTIPLE_CHOICE
const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE'
};

class QuestionService {
  async createQuestion(quizId, data) {
    try {
      // Only support multiple choice
      if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
        throw new Error('options array is required for multiple-choice questions');
      }
      // Each option must have an id
      const options = data.options.map(opt => ({
        ...opt,
        id: uuidv4() || opt.id 
      }));
      // Find the correct option
      const correctOption = options.find(opt => opt.is_correct);
      if (!correctOption) {
        throw new Error('At least one option must be marked as correct (is_correct: true)');
      }
      const questionData = {
        id: uuidv4(),
        quiz_id: quizId,
        question_text: data.text,
        question_type: QUESTION_TYPES.MULTIPLE_CHOICE,
        options,
        correct_answer_id: correctOption.id,
        points: data.points || 1,
        order_index: data.order_index || 0
      };
      const { data: question, error } = await supabase
        .from('quiz_questions')
        .insert([questionData])
        .select()
        .single();
      if (error) throw error;
      return question;
    } catch (error) {
      logger.error('Error creating question:', error);
      throw error;
    }
  }

  async updateQuestion(questionId, data) {
    try {
      const { data: question, error } = await supabaseAdmin
        .from('quiz_questions')
        .update(data)
        .eq('id', questionId)
        .select()
        .single();
      if (error) throw error;
      return question;
    } catch (error) {
      logger.error('Error updating question:', error);
      throw error;
    }
  }


  async getQuestionsByQuiz(quizId) {
    try {
      const { data: questions, error } = await supabaseAdmin
        .from('quiz_questions')
        .select('id, quiz_id, question_text, options, correct_answer_id, order_index, created_at')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return questions;
    } catch (error) {
      logger.error('Error getting questions by quiz:', error);
      throw error;
    }
  }
}

module.exports = QuestionService; 