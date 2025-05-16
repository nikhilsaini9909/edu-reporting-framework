class AnswerService {
  constructor({ Answer }) {
    this.Answer = Answer;
  }

  async createAnswer(questionId, data) {
    return this.Answer.create({ ...data, questionId });
  }

  async updateAnswer(answerId, data) {
    return this.Answer.update(data, { where: { id: answerId } });
  }

  async deleteAnswer(answerId) {
    return this.Answer.destroy({ where: { id: answerId } });
  }

  async getAnswersByQuestion(questionId) {
    return this.Answer.findAll({ where: { questionId } });
  }
}

module.exports = AnswerService; 