const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

module.exports = function createSessionMiddleware() {
  const store = new MySQLStore({
    host: "127.0.0.1",
    user: "root",
    password: "000000",
    database: "gogo",
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000, // 清理周期
    expiration: 24 * 60 * 60 * 1000, // DB层面的过期
  });

  return session({
    secret: process.env.SESSION_SECRET || "REPLACE_WITH_STRONG_SECRET",
    resave: false,
    saveUninitialized: false,
    store,
    name: "sid",
    rolling: true, // 用户有请求就刷新过期时间
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // HTTPS 改 true
      maxAge: 24 * 60 * 60 * 1000, //
    },
  });
};
