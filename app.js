var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const pool = require('./database/db');

var indexRouter = require('./routes/index');
var loginRouter = require('./routes/login');
var ploginRouter = require('./routes/Plogin');
var usersRouter = require('./routes/users');
var signupRouter = require('./routes/signup');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  req.pool = pool; 
  next();
});


app.use('/', indexRouter);
app.use('/login', loginRouter);
app.use('/users', usersRouter);
app.use('/Plogin', ploginRouter);
app.use('/signup', signupRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { title: 'Error Page' });
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
