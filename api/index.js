// ============================================================
// NOTE: This file is intentionally disabled for the root project.
// The backend API is deployed as a SEPARATE Vercel project:
//   Project:  studyhub-api
//   URL:      https://studyhub-api-delta.vercel.app
//   Source:   backend/ directory
//
// The root project (studyhub-app) deploys the FRONTEND only.
// Vercel ignores this file because there is no "functions" key
// referencing api/index.js in the root vercel.json.
// ============================================================

// This export is a no-op placeholder — do not remove this file
// as it is referenced in git history. The actual handler lives
// in backend/api/index.js
export default function handler(req, res) {
  res.status(404).json({
    error: 'Use the API at https://studyhub-api-delta.vercel.app',
  });
}
