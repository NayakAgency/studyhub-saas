// ============================================================
// Environment Variable Validation
// Validates all required env vars on startup
// ============================================================

import 'dotenv/config';

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
];

const optional = [
  'REDIS_URL', // Recommended for production caching
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  const msg = `Missing required environment variables: ${missing.join(', ')}`;
  // In serverless (Vercel), process.exit crashes the function handler.
  // Throw instead so the request gets a 500 with a useful message.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(msg);
  }
  console.error('❌', msg);
  process.exit(1);
}

// Warn about missing optional services
const missingOptional = optional.filter((key) => !process.env[key]);
if (missingOptional.length > 0) {
  console.warn('⚠️  Optional services not configured:');
  missingOptional.forEach((key) => {
    const service = key.includes('REDIS') ? 'Redis Cache (falls back to in-memory)' : key;
    console.warn(`   - ${service} (${key})`);
  });
}

// Warn about weak JWT secret
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is too short. Use at least 32 characters.');
}

export const env = {
  // Supabase
  supabaseUrl:           process.env.SUPABASE_URL,
  supabaseAnonKey:       process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,

  // JWT
  jwtSecret:            process.env.JWT_SECRET,
  jwtExpiresIn:         process.env.JWT_EXPIRES_IN         || '1h',
  jwtRefreshExpiresIn:  process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port:    parseInt(process.env.PORT || '3001', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:9000,http://localhost:5173').split(',').map(s => s.trim()),

  // Cache
  redisUrl: process.env.REDIS_URL || null,

  // App branding
  appUrl:  process.env.APP_URL  || 'http://localhost:9000',
  appName: process.env.APP_NAME || 'StudyHub',

  // Firebase (optional — push notifications)
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT || null,

  // Flags
  isProd: process.env.NODE_ENV === 'production',
  isDev:  process.env.NODE_ENV !== 'production',
};
