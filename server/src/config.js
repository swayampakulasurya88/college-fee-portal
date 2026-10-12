import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  // Serve the built React site from the API server (used on Render/self-hosting).
  serveClient: process.env.SERVE_CLIENT === 'true' || process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/college_fee',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  collegeName: process.env.COLLEGE_NAME || 'College Fee Portal',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
