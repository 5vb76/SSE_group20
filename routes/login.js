var express = require("express");
const transporter = require("./mailtest");
var router = express.Router();

const crypto = require("crypto");
const e = require("express");

const {
  hashPassword,
  comparePassword,
  sha256,
  generateVerificationCode,
  hashToken,
} = require("../utils/crypto");
const {
  validateInput,
  validationRules,
  requireRole,
} = require("../middleware/security");

// Use secure verification code generator
const generateResetCode = () => generateVerificationCode(6);

// Enhanced password validation
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
}

router.get("/", function (req, res, next) {
  res.render("index", { title: "login" });
});

router.get("/checkloginstatus.ajax", function (req, res, next) {
  if (!req.session.user) return res.sendStatus(401);
  if (
    req.session.user.user_type !== "customer" &&
    req.session.user.user_type !== "admin"
  ) {
    console.log(req.session.user.user_type);
    res.destroy("sid");
    return res.sendStatus(403);
  }
  return res.status(200).json({
    success: true,
    user: req.session.user,
    message: "You are logged in.",
  });
});

router.post("/login.ajax", validateInput([validationRules.password]), function (req, res) {
  console.log("req.pool is", !!req.pool);
  var username = req.body.username;
  var password = req.body.password;
  var remember = false;
  if (username == "" || password == "") {
    return res.status(401).json({
      success: false,
      message: "Username and password cannot be empty.",
    });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = "SELECT * FROM users WHERE email = ?";
    connection.query(query, username, function (error, results) {
      //connection.release();
      if (!results || results.length == 0) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid username or password." });
      }
      const password_hash = results[0].password_hash;
      if (sha256(password) == password_hash) {
        const covid_query =
          "SELECT state_name FROM users_covid_status WHERE user_id = ? ORDER BY id DESC LIMIT 1;";
        connection.query(
          covid_query,
          results[0].user_id,
          function (error, covid_results) {
            connection.release();
            if (error) {
              console.log(error);
              return res.sendStatus(500);
            }

            req.session.user = {
              id: results[0].user_id,
              name: results[0].name,
              email: results[0].email,
              user_type: results[0].user_type,
              covid_status: covid_results[0].state_name,
            };
            req.session.isLoggedIn = true;
            if (remember) {
              req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            } else {
              req.session.cookie.maxAge = 1 * 60 * 60 * 1000; // 1 hour
            }
            return res.status(200).json({
              success: true,
              message: "Login successful.",
              user: req.session.user,
            });
          }
        );
      } else {
        connection.release();
        // Passwords don't match
        return res
          .status(401)
          .json({ success: false, message: "Invalid username or password." });
      }
    });
  });
});

router.post("/forget.ajax", function (req, res) {
  var username = req.body.username;
  console.log("req.pool is", !!req.pool);
  if (username == "") {
    return res
      .status(401)
      .json({ success: false, message: "Username cannot be empty." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "SELECT user_id FROM users WHERE email = ? AND user_type != 'pending'";
    connection.query(query, username, function (error, results) {
      if (!results || results.length == 0) {
        return res.status(401).json({
          success: false,
          message: "No such Account, Please try again",
        });
      } else {
        // Send reset email here
        const resetCode = generateResetCode();
        // todo: integrate email service to send the reset code to user's email
        const mailinfo = {
          from: "'SSE_G20 service' <dahaomailp2@gmail.com",
          to: username,
          subject: "Password Reset Code",
          text: `Your password reset code is: ${resetCode}. It is valid for 15 minutes.`,
          html: `<p>Your password reset code is: <b>${resetCode}</b>. It is valid for 15 minutes.</p>`,
        };

        transporter.sendMail(mailinfo, (error, info) => {
          if (error) {
            console.log("Error sending email:", error);
            return res.sendStatus(500);
          }
        });
        // Store reset code in database
        var email_type = "password_reset";
        const InsertQuery =
          "Insert into Email_History (user_id, email_code, email_type) values (?, ?, ?)";
        connection.query(
          InsertQuery,
          [results[0].user_id, resetCode, email_type],
          function (error, results) {
            connection.release();
            if (error) {
              console.log(error);
              return res.sendStatus(500);
            }
            console.log("Reset code stored:", resetCode);
          }
        );

        return res.status(200).json({
          success: true,
          message: "A reset code has been sent to your email.",
        });
      }
    });
  });
});

router.post("/varify_forget.ajax", function (req, res) {
  var email = req.body.username;
  var resetCode = req.body.resetCode;
  console.log("req.pool is", !!req.pool);
  if (resetCode == "") {
    return res
      .status(403)
      .json({ success: false, message: "ResetCode cannot be empty" });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "SELECT rh.*  FROM Email_History rh  JOIN users u ON rh.user_id = u.user_id  WHERE u.email = ?  AND rh.email_type = 'password_reset'  AND rh.created_at >= NOW() - INTERVAL 15 MINUTE  ORDER BY rh.id DESC  LIMIT 1;";
    connection.query(query, email, function (error, results) {
      connection.release();
      if (!results || results.length == 0) {
        return res.sendStatus(401);
      } else if (results[0].email_code == resetCode) {
        return res.send("Reset_OK");
      } else {
        return res.sendStatus(401);
      }
    });
  });
});

router.post("/ChangePass.ajax", validateInput([validationRules.password]), function (req, res) {
  var email = req.body.email;
  var password = req.body.new_password;
  console.log("req.pool is", !!req.pool);
  if (!validatePassword(new_password)) {
    return res.status(403).json({
      success: false,
      message: "New password does not meet the criteria",
    });
  }
  var new_password = sha256(password);

  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = "UPDATE users SET password_hash = ? WHERE email = ?;";
    connection.query(query, [new_password, email], function (error, results) {
      connection.release();
      if (results.affectedRows === 1) {
        return res
          .status(200)
          .json({ success: true, message: "Password updated successfully." });
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Password update failed." });
      }
    });
  });
});

module.exports = router;
