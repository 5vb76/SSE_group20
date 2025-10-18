var express = require("express");
const transporter = require("./mailtest");
var router = express.Router();

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
  res.render("index", { title: "Plogin" });
});

router.post(
  "/login.ajax",
  validateInput([validationRules.email, validationRules.password]),
  async function (req, res) {
    console.log("req.pool is", !!req.pool);
    var username = req.body.email; // Use validated email field
    var password = req.body.password;
    var remember = !!req.body.remember;
    // Input validation is handled by middleware, but keep basic checks
    if (!username || !password) {
      return res.status(401).json({
        success: false,
        message: "Email and password are required.",
      });
    }
    req.pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      const query = "SELECT password_hash FROM provider WHERE email = ?";
      connection.query(query, username, async function (error, results) {
        if (error) {
          connection.release();
          console.log(error);
          return res.sendStatus(500);
        }
        if (!results || results.length == 0) {
          connection.release();
          return res
            .status(401)
            .json({ success: false, message: "Invalid username or password." });
        }
        const password_hash = results[0].password_hash;

        // Check if it's bcrypt hash (starts with $2a$ or $2b$) or legacy SHA256
        let isValidPassword = false;
        if (
          password_hash.startsWith("$2a$") ||
          password_hash.startsWith("$2b$")
        ) {
          isValidPassword = await comparePassword(password, password_hash);
        } else {
          // Legacy SHA256 support
          isValidPassword = sha256(password) === password_hash;
        }

        if (isValidPassword) {
          // Passwords match - regenerate session for security
          req.session.regenerate(function (err) {
            if (err) {
              connection.release();
              console.log(err);
              return res.sendStatus(500);
            }

            req.session.username = username;
            req.session.isLoggedIn = true;
            if (remember) {
              req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
            }

            req.session.save(function (err) {
              connection.release();
              if (err) {
                console.log(err);
                return res.sendStatus(500);
              }
              return res
                .status(200)
                .json({ success: true, message: "Login successful." });
            });
          });
        } else {
          // Passwords don't match
          connection.release();
          return res
            .status(401)
            .json({ success: false, message: "Invalid username or password." });
        }
      });
    });
  }
);

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
      "SELECT user_id FROM provider WHERE email = ? AND user_type != 'pending'";
    connection.query(query, username, function (error, results) {
      connection.release();
      if (!results || results.length == 0) {
        return res.status(401).json({
          success: false,
          message: "No such Account, Please try again",
        });
      } else {
        // Send reset email here
        const resetCode = generateResetCode();

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
          "Insert into P_Email_History (provider_id, email_code, email_type) values (?, ?, ?)";
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
      "SELECT rh.*  FROM P_Email_History rh  JOIN provider u ON rh.provider_id = u.user_id  WHERE u.email = ?  AND rh.email_type = 'password_reset'  AND rh.created_at >= NOW() - INTERVAL 15 MINUTE  ORDER BY rh.id DESC  LIMIT 1;";
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

router.post(
  "/ChangePass.ajax",
  validateInput([validationRules.email, validationRules.password]),
  function (req, res) {
    var email = req.body.email;
    var password = req.body.new_password;
    console.log("req.pool is", !!req.pool);

    if (!validatePassword(password)) {
      return res.status(403).json({
        success: false,
        message:
          "New password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    req.pool.getConnection(async function (error, connection) {
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }

      try {
        // Hash password with bcrypt
        const new_password = await hashPassword(password);

        const query = "UPDATE provider SET password_hash = ? WHERE email = ?;";
        connection.query(
          query,
          [new_password, email],
          function (error, results) {
            connection.release();
            if (error) {
              console.log(error);
              return res.sendStatus(500);
            }
            if (results.affectedRows === 1) {
              return res.status(200).json({
                success: true,
                message: "Password updated successfully.",
              });
            } else {
              return res
                .status(400)
                .json({ success: false, message: "Password update failed." });
            }
          }
        );
      } catch (err) {
        connection.release();
        console.log(err);
        return res.sendStatus(500);
      }
    });
  }
);

router.get("/checkloginstatus.ajax", function (req, res, next) {
  console.log("Checking provider login status...");
  console.log("Session:", req.session);

  if (req.session && req.session.isLoggedIn && req.session.username) {
    console.log("Provider is logged in:", req.session.username);

    // Get provider info from database
    req.pool.getConnection(function (error, connection) {
      if (error) {
        console.log("Database connection error:", error);
        return res
          .status(500)
          .json({ success: false, message: "Database connection error." });
      }

      const query =
        "SELECT user_id, name, email, user_type, description, created_at FROM provider WHERE email = ?";
      connection.query(
        query,
        [req.session.username],
        function (error, results) {
          connection.release();

          if (error) {
            console.log("Database query error:", error);
            return res
              .status(500)
              .json({ success: false, message: "Database query error." });
          }

          if (!results || results.length === 0) {
            console.log("Provider not found in database");
            return res
              .status(401)
              .json({ success: false, message: "Provider not found." });
          }

          const provider = results[0];
          console.log("Provider found:", provider);

          return res.status(200).json({
            success: true,
            message: "Provider is logged in.",
            provider: {
              id: provider.user_id,
              name: provider.name,
              email: provider.email,
              user_type: provider.user_type,
              description: provider.description,
              created_at: provider.created_at,
              covid_status: "Green", // Default status, can be updated later
            },
          });
        }
      );
    });
  } else {
    console.log("Provider is NOT logged in");
    return res
      .status(401)
      .json({ success: false, message: "Provider is not logged in." });
  }
});

module.exports = router;
