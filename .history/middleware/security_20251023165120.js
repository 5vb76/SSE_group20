const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");
const config = require("../config/env");

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Email-specific rate limiting
const emailLimiter = rateLimit({
  windowMs: config.security.emailRateLimitWindowMs,
  max: config.security.emailRateLimitMax,
  message: "Too many email requests, please try again later.",
  skipSuccessfulRequests: true,
});

// Slow down repeated requests
const speedLimiter = slowDown({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000), // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500, // begin adding 500ms of delay per request above 50
});

// Security headers
const isProd = process.env.NODE_ENV === "production";
const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],

      // Vue standalone need 'unsafe-eval' in CSP
      "script-src": isProd
        ? ["'self'", "https://cdn.jsdelivr.net"]
        : [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
          ],
      "script-src-elem": isProd
        ? ["'self'", "https://cdn.jsdelivr.net"]
        : [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://cdn.jsdelivr.net",
          ],

      // Strictly prohibit inline event attributes (production security)
      "script-src-attr": ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
});

// Input validation middleware
const validateInput = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }
    next();
  };
};

// Common validation rules
const validationRules = {
  email: body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email required"),

  password: body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  username: body("username")
    .isLength({ min: 2, max: 50 })
    .withMessage("Username must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage("Username can only contain letters, numbers, and spaces"),

  businessName: body("business_name")
    .isLength({ min: 2, max: 100 })
    .withMessage("Business name must be between 2 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-&.,]+$/)
    .withMessage("Business name contains invalid characters"),

  description: body("description")
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),

  address: body("address")
    .isLength({ min: 5, max: 255 })
    .withMessage("Address must be between 5 and 255 characters"),

  city: body("city")
    .isLength({ min: 2, max: 100 })
    .withMessage("City must be between 2 and 100 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("City can only contain letters and spaces"),

  state: body("state")
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("State can only contain letters and spaces"),

  postcode: body("postcode")
    .isLength({ min: 4, max: 10 })
    .withMessage("Postcode must be between 4 and 10 characters")
    .matches(/^[a-zA-Z0-9\s]+$/)
    .withMessage("Postcode contains invalid characters"),

  covidStatus: body("state_name")
    .isIn(["Green", "Yellow", "Red"])
    .withMessage("COVID status must be Green, Yellow, or Red"),

  serviceId: body("service_id")
    .isInt({ min: 1 })
    .withMessage("Service ID must be a positive integer"),

  productId: body("product_id")
    .isInt({ min: 1 })
    .withMessage("Product ID must be a positive integer"),

  amount: body("amount")
    .isFloat({ min: 0 })
    .withMessage("Amount must be a positive number"),

  quantity: body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.isLoggedIn) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }

    // Determine user role based on session data
    let userRole = "customer"; // default

    if (req.session.user?.user_type) {
      // For customer login
      userRole = req.session.user.user_type;
    } else if (req.session.username) {
      // For provider login
      userRole = "provider";
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(
          ", "
        )}, Your role: ${userRole}`,
      });
    }

    next();
  };
};

// Sanitize input to prevent XSS
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key]
          .replace(/[<>]/g, "") // Remove potential HTML tags
          .trim();
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

module.exports = {
  generalLimiter,
  emailLimiter,
  speedLimiter,
  securityHeaders,
  validateInput,
  validationRules,
  requireRole,
  sanitizeInput,
};
