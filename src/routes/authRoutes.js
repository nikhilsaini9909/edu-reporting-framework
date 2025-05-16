const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
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

// Validation middleware
const validateLoginInput = (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return sendError(res, { message: 'Email and password are required' });
    }
    next();
};

const validateRegistrationInput = (req, res, next) => {
    const { email, password, role, ...profileData } = req.body;
    
    if (!email || !password || !role) {
        return sendError(res, { message: 'Email, password, and role are required' });
    }

    const validRoles = ['admin', 'teacher', 'student'];
    if (!validRoles.includes(role)) {
        return sendError(res, { message: 'Invalid role. Must be admin, teacher, or student' });
    }

    if (role === 'admin' && !profileData.schoolName) {
        return sendError(res, { message: 'School name is required for admin registration' });
    }

    if ((role === 'teacher' || role === 'student') && !profileData.schoolId) {
        return sendError(res, { message: 'School ID is required for teacher and student registration' });
    }

    next();
};

// Auth Routes
router.post('/login', 
    validateLoginInput,
    asyncHandler(async (req, res) => {
        const { email, password, appType } = req.body;
        const result = await authService.login(email, password);
        // Enforce appType restrictions
        if (appType === 'WHITEBOARD' && (result.user.role !== 'teacher' || result.user.role!=="admin")) {
            return sendError(res, { message: 'Only teachers can use the Whiteboard app.' }, 403);
        }
        sendSuccess(res, result);
    })
);

router.post('/register',
    validateRegistrationInput,
    asyncHandler(async (req, res) => {
        const { email, password, role, ...profileData } = req.body;
        const result = await authService.register({
            email,
            password,
            role,
            ...profileData
        });
        sendSuccess(res, {
            ...result,
            message: 'Registration successful. Please check your email for verification.'
        }, 201);
    })
);

router.get('/profile',
    verifyToken,
    asyncHandler(async (req, res) => {
        sendSuccess(res, { user: req.user });
    })
);

router.get('/admin',
    verifyToken,
    checkRole(['admin']),
    asyncHandler(async (req, res) => {
        sendSuccess(res, { message: 'Admin access granted' });
    })
);

module.exports = router; 