require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://couturtech:couturtech@localhost:5432/couturtech',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-a-changer',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  cronSecret: process.env.CRON_SECRET || 'dev-cron-secret',
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'CouturTech <no-reply@couturtech.local>',
  },
  sms: {
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    sender: process.env.SMS_SENDER || 'CouturTech',
  },
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024),
};

if (config.env === 'production' && config.jwtSecret === 'dev-secret-a-changer') {
  throw new Error('JWT_SECRET doit être défini en production');
}

module.exports = config;
