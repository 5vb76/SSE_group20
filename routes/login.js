var express = require('express');
var router = express.Router();

const crypto = require('crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

function validatePassword(password) {
    //todo: varify new password see if it matches the criteria
    return true;
}

router.get('/', function(req, res, next) {
  res.render('index', { title: 'login' });
});

router.post('/login.ajax', function(req, res) {
  console.log('req.pool is', !!req.pool);
  var username = req.body.username;
  var password = req.body.password;
  //var remember = req.body.remember;
  var remember = false; // for debugging
  if(username == '' || password == ''){
    return res.status(401).json({ success: false, message: 'Username and password cannot be empty.' });
  }
   req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }
        const query = 'SELECT password_hash FROM users WHERE email = ?';
        connection.query(query, username, function(error, results) {
            connection.release();
            if(!results || results.length == 0){
                return res.status(401).json({ success: false, message: 'Invalid username or password.' });        
            }
            const password_hash = results[0].password_hash;
            if(sha256(password) == password_hash){
                // Passwords match  
                if (remember) {
                    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 days
                    req.session.username = username;
                    req.session.isLoggedIn = true
                }
                return res.status(200).json({ success: true, message: 'Login successful.' });
            } else {
                // Passwords don't match
                return res.status(401).json({ success: false, message: 'Invalid username or password.' });
            }

        });
    });

});

router.post('/forget.ajax', function(req, res){
    var username = req.body.username;
    console.log('req.pool is', !!req.pool);
    if(username == ''){
        return res.status(401).json({ success: false, message: 'Username cannot be empty.' });
      }
    req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }  
        const query = "SELECT user_id FROM users WHERE email = ? AND user_type != 'pending'"
        connection.query(query, username, function(error, results) {
            if(!results || results.length == 0){
                return res.status(401).json({ success: false, message: 'No such Account, Please try again' });        
            } else {
                // Send reset email here
                const resetCode = generateResetCode();
                // todo: integrate email service to send the reset code to user's email
                
                // Store reset code in database
                var email_type = "password_reset";
                const InsertQuery = 'Insert into Email_History (user_id, email_code, email_type) values (?, ?, ?)';
                connection.query(InsertQuery, [results[0].user_id, resetCode, email_type], function(error, results) {
                    connection.release();
                    if (error) {
                        console.log(error);
                        return res.sendStatus(500);
                    }
                    console.log('Reset code stored:', resetCode);
                });   

                return res.status(200).json({ success: true, message: 'A reset code has been sent to your email.' });
            }
        });
    });
});

router.post('/varify_forget.ajax', function(req, res){
    var email = req.body.username;
    var resetCode = req.body.resetCode;
    console.log('req.pool is', !!req.pool);
    if(resetCode == ''){
        return res.status(403).json({ success: false, message: 'ResetCode cannot be empty' });
      }
    req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }  
        const query = "SELECT rh.*  FROM Email_History rh  JOIN users u ON rh.user_id = u.user_id  WHERE u.email = ?  AND rh.email_type = 'password_reset'  AND rh.created_at >= NOW() - INTERVAL 15 MINUTE  ORDER BY rh.id DESC  LIMIT 1;";
        connection.query(query, email, function(error, results) {
            connection.release();
            if(!results || results.length == 0){
                return res.sendStatus(401);        
            }
            else if(results[0].email_code == resetCode){
                    return res.send("Reset_OK");
            }
            else{
                return res.sendStatus(401);
            }
        });
    });
});

router.post('/ChangePass.ajax', function(req, res){
    var email = req.body.email;
    var password = req.body.new_password;
    console.log('req.pool is', !!req.pool);
    if(!validatePassword(new_password)){
        return res.status(403).json({ success: false, message: 'New password does not meet the criteria' });
    }
    var new_password = sha256(password);

    req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }  
        const query = 'UPDATE users SET password_hash = ? WHERE email = ?;';
        connection.query(query, [new_password,email], function(error, results) {
            connection.release();
            if (results.affectedRows === 1) {
                return res.status(200).json({ success: true, message: 'Password updated successfully.' });
            } else {
                return res.status(400).json({ success: false, message: 'Password update failed.' });
            }
        });
    });
});




module.exports = router;
