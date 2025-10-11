var express = require('express');
const transporter = require('./mailtest');
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

function sendEmail(to, subject, text) {
    //todo: integrate email service to send email: nodemailer
}

router.get('/', function(req, res, next) {
  res.render('index', { title: 'login' });
});

router.post('/c_email_varify.ajax', function(req, res) {
  console.log('req.pool is', !!req.pool);
  var email = req.body.user_email;

  if(email == ''){
    return res.status(401).json({ success: false, message: 'email cannot be empty.' });
  }
   req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500).json({ success: false, message: 'Database connection error.' });
        }
        const query = 'SELECT * FROM users WHERE email = ?';
        connection.query(query, email, function(error, results) {
            if (error) {
                console.log(error);
                connection.release();
                return res.sendStatus(501).json({ success: false, message: 'Database query error.' });
            }
            if(results && results.length > 0 && results[0].user_type != 'pending'){
                connection.release();
                return res.status(401).json({ success: false, message: 'Email is already registered.' });        
            }
        });
                //means new email
                var emailcode = generateResetCode();
                //todo: send email code to the email address

                const mailinfo = {
                    from: "'SSE_G20 service' <dahaomailp2@gmail.com",
                    to: email,
                    subject: 'New Account Register Code',
                    text: `Your Account register code is: ${emailcode}. It is valid for 15 minutes.`,
                    html: `<p>Your Account register code is: <b>${emailcode}</b>. It is valid for 15 minutes.</p>`
                };

                transporter.sendMail(mailinfo, (error, info) => {
                    if (error) {
                        console.log('Error sending email:', error);
                        return res.sendStatus(500);
                    }
                });

                //insert a new user with pending status
                const iquery = "INSERT INTO users (name, email, password_hash, user_type) VALUES (?, ?, ?, 'pending')";
                connection.query(iquery, ['pending', email, 'pending'], function(error, results) {
                    if (error) {
                        console.log(error);
                        return res.status(501).json({ success: false, message: 'Database insert error.' });
                    }

                    var user_id = results.insertId;

                    //store the code to the database
                    const insertQuery = 'INSERT INTO Email_History (user_id, email_code, email_type) VALUES (?, ?, ?)';
                    connection.query(insertQuery, [user_id, emailcode, 'registration'], function(error, results) {
                        if (error) {
                            console.log(error);
                            return res.status(503).json({ success: false, message: 'Database insert error.' });
                        }
                        connection.release();
                        console.log('Verification code stored:', emailcode);
                        return res.status(200).json({ success: true, message: 'A verification code has been sent to your email.' });
                    });
            });

    });

});

router.post('/Cregister.ajax', function(req, res){
    var username = req.body.user_name;
    var email = req.body.user_email;
    var password = req.body.user_password;
    var varifyEmailCode = req.body.varifyEmailCode;

    console.log('req.pool is', !!req.pool); 

    if(username == '' || email == '' || password == '' || varifyEmailCode == ''){
        return res.status(401).json({ success: false, message: 'All fields are required.' });
      }
    if(!validatePassword(password)){
        return res.status(402).json({ success: false, message: 'Password does not meet the criteria.' });
    }

    req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }
        const query = "SELECT rh.*  FROM Email_History rh  JOIN users u ON rh.user_id = u.user_id  WHERE u.email = ?  AND rh.email_type = 'registration'  AND rh.created_at >= NOW() - INTERVAL 15 MINUTE  ORDER BY rh.id DESC  LIMIT 1;";
        connection.query(query, email, function(error, results) {
            if (error) {
                console.log(error);
                connection.release();
                return res.sendStatus(501);
            }
            if(!results || results.length == 0){
                connection.release();
                return res.status(401).json({ success: false, message: 'No verification code found or code expired.' });        
            }
            else if(results[0].email_code == varifyEmailCode){
                //update the user info
                var password_hash = sha256(password);
                const uquery = "UPDATE users SET name = ?, password_hash = ?, user_type = 'customer' WHERE email = ?";
                connection.query(uquery, [username, password_hash, email], function(error, results) {
                    //connection.release();
                    if (error) {
                        console.log(error);
                        return res.status(502).json({ success: false, message: 'Database update error.' });
                    }
                    //add to users_covid_status table with default green status
                    const cquery = "INSERT INTO users_covid_status (user_id, state_name) VALUES ((SELECT user_id FROM users WHERE email = ?), 'Green')";
                    connection.query(cquery, [email], function(error, results) {
                        connection.release();
                            if (error) {
                                console.log(error);
                                return res.status(504).json({ success: false, message: 'Database insert error.' });
                            }
                    });

                    return res.status(200).json({ success: true, message: 'Registration successful.' });
                });
            }
            else{
                connection.release();
                return res.status(403).json({ success: false, message: 'Invalid verification code.' });
            }
        });
    });
});

router.post('/p_email_varify.ajax', function(req, res) {
    console.log('req.pool is', !!req.pool);
    var email = req.body.email;
    if(email == ''){
        return res.status(401).json({ success: false, message: 'email cannot be empty.' });
      }
        req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500).json({ success: false, message: 'Database connection error.' });
        }
        const query = 'SELECT * FROM provider WHERE email = ?';
        connection.query(query, [email], function(error, results) {
            if (error) {
                console.log(error);
                connection.release();
                return res.sendStatus(501).json({ success: false, message: 'Database query error.' });
            }
            if(results && results.length > 0){
                connection.release();
                return res.status(401).json({ success: false, message: 'Email is already registered.' });     
            }

                //means new email
        var emailcode = generateResetCode();

        const mailinfo = {
                    from: "'SSE_G20 service' <dahaomailp2@gmail.com",
                    to: email,
                    subject: 'New Account Register Code',
                    text: `Your Account register code is: ${emailcode}. It is valid for 15 minutes.`,
                    html: `<p>Your Account register code is: <b>${emailcode}</b>. It is valid for 15 minutes.</p>`
                };

                transporter.sendMail(mailinfo, (error, info) => {
                    if (error) {
                        console.log('Error sending email:', error);
                        return res.sendStatus(500);
                    }
                });

        const iquery = "INSERT INTO provider (name, email, password_hash, user_type) VALUES (?, ?, ?, ?)";
        connection.query(iquery, ['pending', email, 'pending', 'pending'], function(error, results) {
            if (error) {
                console.log(error);
                return res.status(501).json({ success: false, message: 'Database insert error.' });
            }
            var provider_id = results.insertId;

            //store the code to the database
            const insertQuery = 'INSERT INTO P_Email_History (provider_id, email_code, email_type) VALUES (?, ?, ?)';
            connection.query(insertQuery, [provider_id, emailcode, 'registration'], function(error, results) {
                if (error) {
                    connection.release();
                    console.log(error);
                    return res.status(503).json({ success: false, message: 'Database insert error.' });
                }
                connection.release();
                console.log('Verification code stored:', emailcode);
                return res.status(200).json({ success: true, message: 'A verification code has been sent to your email.' });
                });
            });
        });
            
    });          
});    

router.post('/Pregister.ajax', function(req, res){
    var username = req.body.provider_name;
    var email = req.body.provider_email;
    var password = req.body.provider_password;
    var varifyEmailCode = req.body.provider_varifyEmailCode;

    var address = req.body.provider_address;
    var city = req.body.provider_city;
    var state = req.body.provider_state;
    var postcode = req.body.provider_postcode;

    console.log('req.pool is', !!req.pool);
    if(username == '' || email == '' || password == '' || varifyEmailCode == '' || address == ''){
        return res.status(401).json({ success: false, message: 'All fields are required.' });
      }
    if(!validatePassword(password)){
        return res.status(402).json({ success: false, message: 'Password does not meet the criteria.' });
    }
    req.pool.getConnection(function(error, connection) {
        if (error) {
            console.log(error);
            return res.sendStatus(500);
        }
        const query = "SELECT rh.*  FROM P_Email_History rh  JOIN provider p ON rh.provider_id = p.user_id  WHERE p.email = ?  AND rh.email_type = 'registration'  AND rh.created_at >= NOW() - INTERVAL 15 MINUTE  ORDER BY rh.id DESC  LIMIT 1;";
        connection.query(query, [email], function(error, results) {
            if (error) {
                console.log(error);
                connection.release();
                return res.sendStatus(501);
            }
            if(!results || results.length == 0){
                connection.release();
                return res.status(401).json({ success: false, message: 'No verification code found or code expired.' });        
            }
            else if(results[0].email_code == varifyEmailCode){
                //update the user info
                var password_hash = sha256(password);
                const uquery = "UPDATE provider SET name = ?, password_hash = ?, user_type = 'provider' WHERE email = ?";
                connection.query(uquery, [username, password_hash, email], function(error, results) {
                    //connection.release();
                    if (error) {
                        console.log(error);
                        return res.status(502).json({ success: false, message: 'Database update error.' });
                    }

                    //add to provider address table
                    const aquery = "INSERT INTO provider_address (provider_id, address, city, state, postcode) VALUES ((SELECT user_id FROM provider WHERE email = ?), ?, ?, ?, ?)";
                    connection.query(aquery, [email, address, city, state, postcode], function(error, results) {
                        //connection.release();
                            if (error) {
                                console.log(error);
                                return res.status(504).json({ success: false, message: 'Database insert error.' });
                            }
                            //add to users_covid_status table with default green status
                            const cquery = "INSERT INTO providers_covid_status (provider_id, state_name) VALUES ((SELECT user_id FROM provider WHERE email = ?), 'Green')";
                            connection.query(cquery, [email], function(error, results) {
                                connection.release();
                                if (error) {
                                    console.log(error);
                                    return res.status(504).json({ success: false, message: 'Database insert error.' });
                                }
                            });
                    });
                    return res.status(200).json({ success: true, message: 'Registration successful.', redirectUrl: '/provider_login.html' });
                });
            }
            else{
                connection.release();
                return res.status(403).json({ success: false, message: 'Invalid verification code.' });
            }

        });
    });
});


module.exports = router;
