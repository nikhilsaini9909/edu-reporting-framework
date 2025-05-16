const express = require('express');
const router = express.Router();
const userManagementService = require('../services/userManagementService');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

// Utility functions for consistent response handling
const sendSuccess = (res, data, status = 200) => {
    res.status(status).json({
        success: true,
        data
    });
};

const sendError = (res, error, status = 400) => {
    logger.error(error);
    res.status(status).json({
        success: false,
        error: { message: error.message }
    });
};

// Error handling middleware
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
        sendError(res, error);
    });
};

// School Management Routes
router.post('/schools', asyncHandler(async (req, res) => {
    const result = await userManagementService.createSchool(req.body);
    sendSuccess(res, result, 201);
}));

// Teacher Management Routes
router.post('/teachers', 
    verifyToken, 
    checkRole(['admin']), 
    asyncHandler(async (req, res) => {
        const result = await userManagementService.createTeacher(req.body, req.user.schoolId);
        sendSuccess(res, result, 201);
    })
);

router.get('/teachers', 
    verifyToken, 
    checkRole(['admin']), 
    asyncHandler(async (req, res) => {
        const teachers = await userManagementService.listUsers('teacher', req.user.schoolId);
        sendSuccess(res, teachers);
    })
);

// Student Management Routes
router.post('/students', 
    verifyToken, 
    checkRole(['admin', 'teacher']), 
    asyncHandler(async (req, res) => {
        const result = await userManagementService.createStudent(req.body, req.user.schoolId);
        sendSuccess(res, result, 201);
    })
);

router.get('/students', 
    verifyToken, 
    checkRole(['admin', 'teacher']), 
    asyncHandler(async (req, res) => {
        const students = await userManagementService.listUsers('student', req.user.schoolId);
        sendSuccess(res, students);
    })
);

// Classroom Management Routes
router.post('/classrooms', 
    verifyToken, 
    checkRole(['admin', 'teacher']), 
    asyncHandler(async (req, res) => {
        const result = await userManagementService.createClassroom(req.body, req.user);
        sendSuccess(res, result, 201);
    })
);

module.exports = router; 