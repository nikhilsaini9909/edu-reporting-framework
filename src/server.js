require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const { setupRoutes } = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const WebSocketHandler = require('./websocket');
const logger = require('./utils/logger');

// Configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: NODE_ENV === 'production' ? undefined : false
}));

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WebSocket setup
const wss = new WebSocket.Server({ 
    server,
    path: '/ws',
    verifyClient: (info, callback) => {
        // Allow the connection, we'll verify the token in the WebSocket handler
        callback(true);
    }
});
const wsHandler = new WebSocketHandler(wss);

// Setup routes
setupRoutes(app, wsHandler);

// Error handling
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
    logger.info(`Server is running in ${NODE_ENV} mode on port ${PORT}`);
    logger.info(`WebSocket server is running on path /ws`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}); 