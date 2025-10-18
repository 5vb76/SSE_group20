const mysql = require("mysql2");
const config = require("../config/env");

const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

pool.getConnection(function (err, connection) {
  if (err) {
    console.error("Service db connection FAILED!", err.message);
  } else {
    console.log("Service db connection SUCCESS!");
    connection.release();
  }
});

module.exports = pool;
