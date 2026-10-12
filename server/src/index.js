import app from './app.js';
import { connectDB } from './db.js';
import { config } from './config.js';

connectDB()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[api] ${config.collegeName} API running on http://localhost:${config.port}`);
    });
  })
  .catch((err) => {
    console.error('[api] failed to start:', err.message);
    process.exit(1);
  });

export default app;
