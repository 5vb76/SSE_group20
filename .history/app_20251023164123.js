var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const pool = require("./database/db");
const {
  generalLimiter,
  emailLimiter,
  speedLimiter,
  securityHeaders,
  sanitizeInput,
  requireRole,
} = require("./middleware/security");

var createSessionMiddleware = require("./routes/session");
var indexRouter = require("./routes/index");
var loginRouter = require("./routes/login");
var ploginRouter = require("./routes/Plogin");
var providerMainRouter = require("./routes/Provider_main");
var usersRouter = require("./routes/users");
var signupRouter = require("./routes/signup");
var usermainRouter = require("./routes/User_main");

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

// Security middleware
app.use(securityHeaders);
app.use(generalLimiter);
app.use(speedLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use(sanitizeInput);

app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(createSessionMiddleware());

app.use((req, res, next) => {
  req.pool = pool;
  next();
});

app.use("/", indexRouter);
app.use("/users", usersRouter);
// Provider routes - only accessible by providers
app.use("/provider_main", requireRole(["provider"]), providerMainRouter);
app.use("/Provider_main", requireRole(["provider"]), providerMainRouter);
// User routes - only accessible by customers
app.use("/User_main", requireRole(["customer"]), usermainRouter);
// Public routes
app.use("/signup", emailLimiter, signupRouter);
app.use("/login", emailLimiter, loginRouter);
app.use("/Plogin", emailLimiter, ploginRouter);
app.use("/plogin", emailLimiter, ploginRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error", { title: "Error Page" });
});

// app.get('/users', (req, res) => {
//   db.all('SELECT * FROM users', [], (err, rows) => {
//     if (err) {
//       console.error(err.message);
//       res.status(500).json({ error: err.message });
//     } else {
//       res.json(rows);
//     }
//   });
// });

module.exports = app;
