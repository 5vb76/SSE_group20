const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config/env");

// Password hashing
const hashPassword = async (password) => {
  return await bcrypt.hash(password, config.security.bcryptRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Legacy SHA256 support (for existing data)
const sha256 = (text) => {
  return crypto.createHash("sha256").update(text).digest("hex");
};

// Generate secure random tokens
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Generate verification codes
const generateVerificationCode = (length = 6) => {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Hash tokens before storing in database
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Verify token against hash
const verifyToken = (token, hash) => {
  return hashToken(token) === hash;
};

// Generate session ID
const generateSessionId = () => {
  return crypto.randomBytes(32).toString("hex");
};

module.exports = {
  hashPassword,
  comparePassword,
  sha256,
  generateSecureToken,
  generateVerificationCode,
  hashToken,
  verifyToken,
  generateSessionId,
};
