const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: '000000',
  database: 'covid_service',

});

pool.getConnection(function(err, connection) {
  if (err) {
    console.error('Service db connection FAILED!', err.message);
  } else {
    console.log('Service db connection SUCCESS!');
    connection.release();
  }
});

module.exports = pool;