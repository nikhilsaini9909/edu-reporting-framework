const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const quizRoutes = require('./quizRoutes');
const quizAttemptRoutes = require('./quizAttemptRoutes');
const logger = require('../utils/logger');
const eventRoutes = require("./eventRoutes")
// Health check middleware
const healthCheck = (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
};

// API version middleware
const apiVersion = (req, res, next) => {
    res.setHeader('X-API-Version', '1.0.0');
    next();
};

const setupRoutes = (app, wsHandler) => {
    // Global middleware
    app.use(apiVersion);

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/quizzes', require('./quizRoutes')(wsHandler));
    app.use('/api/quiz-attempts', require('./quizAttemptRoutes')(wsHandler));
    app.use("/api/events", eventRoutes)

    // Health check route
    app.get('/health', healthCheck);

    // 404 handler
    app.use((req, res) => {
        logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
        res.status(404).json({
            success: false,
            error: { message: 'Route not found' }
        });
    });
};

module.exports = { setupRoutes }; 