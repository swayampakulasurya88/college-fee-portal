import app from '../server/src/app.js';
import { connectDB } from '../server/src/db.js';

// Reuse a single MongoDB connection across warm serverless invocations.
function ensureDb() {
  const g = globalThis;
  if (!g.__collegeFeeDb) {
    g.__collegeFeeDb = connectDB().catch((err) => {
      g.__collegeFeeDb = undefined;
      throw err;
    });
  }
  return g.__collegeFeeDb;
}

// Vercel invokes this for every /api/* request. The Express app already
// mounts its routes under /api, so it handles the request directly.
export default async function handler(req, res) {
  try {
    await ensureDb();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Database connection failed', detail: err.message }));
    return;
  }
  return app(req, res);
}
