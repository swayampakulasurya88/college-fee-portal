import jwt from 'jsonwebtoken';
import { config } from '../config.js';

// Verifies the bearer token and attaches the decoded payload to req.user.
export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired, please log in again' });
  }
}

export function adminOnly(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
}

export function studentOnly(req, res, next) {
  if (req.user?.role === 'student') return next();
  return res.status(403).json({ message: 'Student access required' });
}
