const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const config = require("../config/env");

module.exports = function createSessionMiddleware() {
  const store = new MySQLStore({
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.sessionName,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000, // 15 minutes
    expiration: 24 * 60 * 60 * 1000, // 24 hours
    createDatabaseTable: true,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data",
      },
    },
  });

  return session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false,
    store,
    name: "sid",
    rolling: true,
    cookie: config.session.cookie,
    genid: () => require("../utils/crypto").generateSessionId(),
  });
};
