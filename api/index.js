// ============================================================
// Vercel Serverless Entry Point
// Wraps the Express app for Vercel Functions
// ============================================================

// Load env validation (non-exiting version for serverless)
import 'dotenv/config';

import app from '../backend/src/app.js';

export default app;
