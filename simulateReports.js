// simulateReports.js
//
// Usage:
//   1. Install dependencies: npm install csv-writer
//   2. Run: node simulateReports.js

const { createObjectCsvWriter } = require('csv-writer');

// --- CONFIGURABLE PARAMETERS ---
const NUM_QUIZZES = 6;
const QUESTIONS_PER_QUIZ = 8;
const NUM_STUDENTS = 20;
const NUM_TEACHERS = 3;
const NUM_CLASSROOMS = 4;
const OPTIONS_PER_QUESTION = 4;
const DEVICES = ['Notebook', 'Whiteboard'];

// --- DATA SIMULATION HELPERS ---
function randomName() {
  const first = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie', 'Riley', 'Chris', 'Robin', 'Drew', 'Avery', 'Skyler', 'Peyton', 'Quinn', 'Dakota', 'Harper', 'Reese', 'Rowan', 'Sawyer'];
  const last = ['Smith', 'Lee', 'Patel', 'Kim', 'Garcia', 'Brown', 'Singh', 'Chen', 'Nguyen', 'Martinez', 'Clark', 'Lewis', 'Walker', 'Young', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson'];
  return `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
}
function randomFrom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function randomDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }

// --- Generate Teachers ---
const teachers = Array.from({length: NUM_TEACHERS}, (_, i) => ({
  id: `t${i+1}`,
  name: randomName(),
}));

// --- Generate Classrooms ---
const classrooms = Array.from({length: NUM_CLASSROOMS}, (_, i) => ({
  id: `c${i+1}`,
  name: `Classroom ${i+1}`,
  teacherId: teachers[i % NUM_TEACHERS].id,
}));

// --- Generate Students and assign to classrooms ---
const students = Array.from({length: NUM_STUDENTS}, (_, i) => {
  const classroom = classrooms[i % NUM_CLASSROOMS];
  return {
    id: `stu${i+1}`,
    name: randomName(),
    classroomId: classroom.id,
    grade: 5 + (i % 4),
  };
});

// --- Generate quizzes and questions ---
const quizzes = Array.from({length: NUM_QUIZZES}, (_, qzIdx) => {
  const quizId = `quiz${qzIdx+1}`;
  const classroom = classrooms[qzIdx % NUM_CLASSROOMS];
  const teacher = teachers.find(t => t.id === classroom.teacherId);
  const questions = Array.from({length: QUESTIONS_PER_QUIZ}, (_, qIdx) => {
    const questionId = `${quizId}_q${qIdx+1}`;
    const correctAnswer = Math.floor(Math.random()*OPTIONS_PER_QUESTION);
    return {
      id: questionId,
      text: `Question ${qIdx+1} of ${quizId}`,
      options: Array.from({length: OPTIONS_PER_QUESTION}, (_, oIdx) => `Option ${oIdx+1}`),
      correctAnswerId: correctAnswer,
      contentDisplayCount: Math.floor(Math.random()*5)+1,
      avgViewTime: Math.floor(Math.random()*30)+10, // seconds
      contentDisplayDevice: randomFrom(DEVICES),
      teacherFeedback: Math.random() < 0.2 ? 'Needs improvement' : '',
    };
  });
  return {
    id: quizId,
    title: `Quiz ${qzIdx+1}`,
    classroomId: classroom.id,
    teacherName: teacher.name,
    questions,
    sessionId: `sess_${quizId}`,
    date: randomDate(new Date(2024, 3, 1), new Date(2024, 4, 15)),
  };
});

// --- SIMULATE EVENTS & ATTEMPTS ---
const events = [];
const attempts = [];

students.forEach(student => {
  quizzes.forEach(quiz => {
    // Simulate session join event
    events.push({
      type: 'SESSION_JOINED',
      studentId: student.id,
      classroomId: student.classroomId,
      quizId: quiz.id,
      sessionId: quiz.sessionId,
      device: 'Notebook',
      timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
    });
    // Quiz start event
    events.push({
      type: 'QUIZ_ATTEMPT_STARTED',
      studentId: student.id,
      quizId: quiz.id,
      classroomId: student.classroomId,
      sessionId: quiz.sessionId,
      device: 'Notebook',
      timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
    });
    const attempt = {
      studentId: student.id,
      studentName: student.name,
      classroomId: student.classroomId,
      classroomName: classrooms.find(c => c.id === student.classroomId).name,
      teacherName: quiz.teacherName,
      quizId: quiz.id,
      quizTitle: quiz.title,
      sessionId: quiz.sessionId,
      device: 'Notebook',
      attemptTime: quiz.date,
      answers: [],
      startTime: quiz.date.getTime(),
    };
    quiz.questions.forEach(question => {
      // Simulate content display event
      events.push({
        type: 'CONTENT_DISPLAYED',
        studentId: student.id,
        quizId: quiz.id,
        questionId: question.id,
        device: question.contentDisplayDevice,
        contentDisplayCount: question.contentDisplayCount,
        avgViewTime: question.avgViewTime,
        timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
      });
      // Simulate answer (random, sometimes correct, sometimes not)
      const isCorrect = Math.random() < 0.6; // 60% chance to be correct
      const answerId = isCorrect ? question.correctAnswerId : Math.floor(Math.random()*OPTIONS_PER_QUESTION);
      const timeTaken = Math.floor(Math.random()*30) + 5; // 5-35 seconds
      attempt.answers.push({
        questionId: question.id,
        answerId,
        isCorrect: answerId === question.correctAnswerId,
        timeTaken,
        device: 'Notebook',
        answerTime: quiz.date.getTime() + Math.floor(Math.random()*10000),
      });
      // Answer event
      events.push({
        type: 'QUIZ_ANSWER_SUBMITTED',
        studentId: student.id,
        quizId: quiz.id,
        questionId: question.id,
        answerId,
        isCorrect: answerId === question.correctAnswerId,
        timeTaken,
        device: 'Notebook',
        timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
      });
    });
    attempt.endTime = attempt.startTime + attempt.answers.reduce((sum, a) => sum + a.timeTaken*1000, 0);
    attempts.push(attempt);
    // Quiz finish event
    events.push({
      type: 'QUIZ_ATTEMPT_COMPLETED',
      studentId: student.id,
      quizId: quiz.id,
      classroomId: student.classroomId,
      sessionId: quiz.sessionId,
      device: 'Notebook',
      timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
    });
    // Simulate session leave event
    events.push({
      type: 'SESSION_LEFT',
      studentId: student.id,
      classroomId: student.classroomId,
      quizId: quiz.id,
      sessionId: quiz.sessionId,
      device: 'Notebook',
      timestamp: quiz.date.getTime() + Math.floor(Math.random()*10000),
    });
  });
});

// --- REPORT 1: Student Performance Analysis ---
const studentPerformance = [];
attempts.forEach(attempt => {
  const correct = attempt.answers.filter(a => a.isCorrect).length;
  const total = attempt.answers.length;
  const avgTime = (attempt.answers.reduce((sum, a) => sum + a.timeTaken, 0)/total).toFixed(1);
  studentPerformance.push({
    studentId: attempt.studentId,
    studentName: attempt.studentName,
    classroomId: attempt.classroomId,
    classroomName: attempt.classroomName,
    teacherName: attempt.teacherName,
    quizId: attempt.quizId,
    quizTitle: attempt.quizTitle,
    sessionId: attempt.sessionId,
    device: attempt.device,
    attemptTime: new Date(attempt.attemptTime).toISOString(),
    score: correct,
    total,
    accuracy: ((correct/total)*100).toFixed(1) + '%',
    avgTimeSec: avgTime,
  });
});

// --- REPORT 2: Classroom Engagement Metrics ---
const engagement = [];
quizzes.forEach(quiz => {
  const quizAttempts = attempts.filter(a => a.quizId === quiz.id);
  const participation = quizAttempts.length;
  const avgTime = (quizAttempts.reduce((sum, a) => sum + a.answers.reduce((s, ans) => s + ans.timeTaken, 0), 0) / (quizAttempts.length * quiz.questions.length)).toFixed(1);
  const engagementScore = ((participation / students.filter(s => s.classroomId === quiz.classroomId).length) * 100).toFixed(1) + '%';
  const deviceBreakdown = 'Notebook: ' + quizAttempts.length;
  engagement.push({
    classroomId: quiz.classroomId,
    classroomName: classrooms.find(c => c.id === quiz.classroomId).name,
    teacherName: quiz.teacherName,
    quizId: quiz.id,
    quizTitle: quiz.title,
    sessionId: quiz.sessionId,
    date: quiz.date.toISOString().split('T')[0],
    participation,
    avgTimePerQuestionSec: avgTime,
    engagementScore,
    deviceBreakdown,
  });
});

// --- REPORT 3: Content Effectiveness Evaluation ---
const contentEffectiveness = [];
quizzes.forEach(quiz => {
  quiz.questions.forEach(question => {
    const allAnswers = attempts
      .filter(a => a.quizId === quiz.id)
      .map(a => a.answers.find(ans => ans.questionId === question.id));
    const correct = allAnswers.filter(a => a && a.isCorrect).length;
    const total = allAnswers.length;
    const avgTime = (allAnswers.reduce((sum, a) => sum + (a ? a.timeTaken : 0), 0)/total).toFixed(1);
    contentEffectiveness.push({
      quizId: quiz.id,
      quizTitle: quiz.title,
      classroomId: quiz.classroomId,
      classroomName: classrooms.find(c => c.id === quiz.classroomId).name,
      teacherName: quiz.teacherName,
      questionId: question.id,
      questionText: question.text,
      correct,
      total,
      correctRate: ((correct/total)*100).toFixed(1) + '%',
      avgTimeSec: avgTime,
      device: 'Notebook', // Only students answer, so always Notebook
      avgViewTime: question.avgViewTime,
      teacherFeedback: question.teacherFeedback,
    });
  });
});

// --- CSV EXPORT HELPERS ---
async function writeCSV(filename, header, records) {
  const csvWriter = createObjectCsvWriter({
    path: filename,
    header,
  });
  await csvWriter.writeRecords(records);
  console.log(`Report written: ${filename}`);
}

(async () => {
  await writeCSV('student_performance.csv', [
    {id: 'studentId', title: 'Student ID'},
    {id: 'studentName', title: 'Student Name'},
    {id: 'classroomId', title: 'Classroom ID'},
    {id: 'classroomName', title: 'Classroom Name'},
    {id: 'teacherName', title: 'Teacher Name'},
    {id: 'quizId', title: 'Quiz ID'},
    {id: 'quizTitle', title: 'Quiz Title'},
    {id: 'sessionId', title: 'Session ID'},
    {id: 'device', title: 'Device'},
    {id: 'attemptTime', title: 'Attempt Time'},
    {id: 'score', title: 'Score'},
    {id: 'total', title: 'Total Questions'},
    {id: 'accuracy', title: 'Accuracy'},
    {id: 'avgTimeSec', title: 'Avg Time (sec)'},
  ], studentPerformance);

  await writeCSV('classroom_engagement.csv', [
    {id: 'classroomId', title: 'Classroom ID'},
    {id: 'classroomName', title: 'Classroom Name'},
    {id: 'teacherName', title: 'Teacher Name'},
    {id: 'quizId', title: 'Quiz ID'},
    {id: 'quizTitle', title: 'Quiz Title'},
    {id: 'sessionId', title: 'Session ID'},
    {id: 'date', title: 'Date'},
    {id: 'participation', title: 'Participation'},
    {id: 'avgTimePerQuestionSec', title: 'Avg Time/Question (sec)'},
    {id: 'engagementScore', title: 'Engagement Score'},
    {id: 'deviceBreakdown', title: 'Device Breakdown'},
  ], engagement);

  await writeCSV('content_effectiveness.csv', [
    {id: 'quizId', title: 'Quiz ID'},
    {id: 'quizTitle', title: 'Quiz Title'},
    {id: 'classroomId', title: 'Classroom ID'},
    {id: 'classroomName', title: 'Classroom Name'},
    {id: 'teacherName', title: 'Teacher Name'},
    {id: 'questionId', title: 'Question ID'},
    {id: 'questionText', title: 'Question Text'},
    {id: 'correct', title: 'Correct Answers'},
    {id: 'total', title: 'Total Attempts'},
    {id: 'correctRate', title: 'Correct Rate'},
    {id: 'avgTimeSec', title: 'Avg Time (sec)'},
    {id: 'device', title: 'Device (Answer Submission)'},
    {id: 'avgViewTime', title: 'Avg View Time (sec)'},
    {id: 'teacherFeedback', title: 'Teacher Feedback'},
  ], contentEffectiveness);
})(); 