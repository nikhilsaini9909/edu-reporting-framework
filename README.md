# Educational Analytics Reporting Framework

A real-time analytics and reporting system for educational applications, focusing on Whiteboard and Notebook apps with Quiz features.

## Features

- Real-time data collection from educational applications
- WebSocket-based quiz interactions
- Role-based access control (RBAC) with JWT
- Integration with Supabase for data storage
- Real-time dashboard updates
- Comprehensive event tracking and analytics

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and project

## Project Structure

```
┣ 📂logs
┣ 📂src
┃ ┣ 📂config
┃ ┃ ┣ 📂migrations
┃ ┃ ┃ ┗ 📜alter_classrooms_created_by.sql
┃ ┃ ┣ 📜schema.sql
┃ ┃ ┗ 📜supabase.js
┃ ┣ 📂events_test
┃ ┣ 📂middleware
┃ ┃ ┣ 📜authMiddleware.js
┃ ┃ ┗ 📜errorHandler.js
┃ ┣ 📂migrations
┃ ┃ ┗ 📜create_sessions_table.sql
┃ ┣ 📂models
┃ ┣ 📂routes
┃ ┃ ┣ 📜authRoutes.js
┃ ┃ ┣ 📜eventRoutes.js
┃ ┃ ┣ 📜index.js
┃ ┃ ┣ 📜quizAttemptRoutes.js
┃ ┃ ┣ 📜quizRoutes.js
┃ ┃ ┗ 📜userRoutes.js
┃ ┣ 📂services
┃ ┃ ┣ 📜answerService.js
┃ ┃ ┣ 📜authService.js
┃ ┃ ┣ 📜eventService.js
┃ ┃ ┣ 📜questionService.js
┃ ┃ ┣ 📜quizAttemptService.js
┃ ┃ ┣ 📜studentResponseService.js
┃ ┃ ┗ 📜userManagementService.js
┃ ┣ 📂utils
┃ ┃ ┗ 📜logger.js
┃ ┣ 📂websocket
┃ ┃ ┗ 📜index.js
┃ ┗ 📜server.js
┣ 📜.env
┣ 📜classroom_engagement.csv
┣ 📜content_effectiveness.csv
┣ 📜instruction.md
┣ 📜package.json
┣ 📜README.md
┣ 📜simulateReports.js
┗ 📜student_performance.csv

```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and update the variables:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRES_IN`: JWT token expiration time
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key


## WebSocket Events

- `QUIZ_INTERACTION`: Handle real-time quiz interactions
