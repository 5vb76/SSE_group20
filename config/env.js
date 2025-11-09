require("dotenv").config();

module.exports = {
  database: {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "12345678",
    name: process.env.DB_NAME || "covid_service",
    sessionName: process.env.SESSION_DB_NAME || "gogo",
  },
  session: {
    secret:
      process.env.SESSION_SECRET || "fallback_secret_change_in_production",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  email: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || "dahaomailp2@gmail.com",
    pass: process.env.SMTP_PASS || "your_app_password_here",
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    emailRateLimitMax: parseInt(process.env.EMAIL_RATE_LIMIT_MAX) || 15,
    emailRateLimitWindowMs:
      parseInt(process.env.EMAIL_RATE_LIMIT_WINDOW_MS) || 300000, // 5 minutes
  },
  environment: process.env.NODE_ENV || "development",
};
