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
const { validateInput, validationRules } = require("../middleware/security");

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

function sendEmail(to, subject, text) {}

router.get("/", function (req, res) {
  res.render("index", { title: "login" });
});

/**
 * Customer email verify – send code & create pending user
 */
router.post("/c_email_varify.ajax", function (req, res) {
  console.log("req.pool is", !!req.pool);
  const email = req.body.user_email;

  if (!email) {
    return res
      .status(401)
      .json({ success: false, message: "email cannot be empty." });
  }

  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: "Database connection error." });
    }
    const query = "SELECT * FROM users WHERE email = ?";
    connection.query(query, [email], function (error, results) {
      if (error) {
        console.log(error);
        connection.release();
        return res
          .status(501)
          .json({ success: false, message: "Database query error." });
      }

      if (results && results.length > 0 && results[0].user_type !== "pending") {
        connection.release();
        return res
          .status(401)
          .json({ success: false, message: "Email is already registered." });
      }

      // Generate new verification code
      const emailcode = generateResetCode();

      const mailinfo = {
        from: '"SSE_G20 service" <dahaomailp2@gmail.com>',
        to: email,
        subject: "New Account Register Code",
        text: `Your Account register code is: ${emailcode}. It is valid for 15 minutes.`,
        html: `<p>Your Account register code is: <b>${emailcode}</b>. It is valid for 15 minutes.</p>`,
      };

      transporter.sendMail(mailinfo, (error) => {
        if (error) {
          console.log("Error sending email:", error);
        }
      });

      // Handle existing pending user or create new one
      let user_id;
      if (results && results.length > 0 && results[0].user_type === "pending") {
        // Update existing pending user
        user_id = results[0].user_id;
        const updateQuery = "UPDATE users SET name = 'pending' WHERE user_id = ?";
        connection.query(updateQuery, [user_id], function (error) {
          if (error) {
            console.log(error);
            connection.release();
            return res
              .status(501)
              .json({ success: false, message: "Database update error." });
          }
          // Continue to store verification code
          storeVerificationCode();
        });
      } else {
        // Insert new pending user
        const iquery =
          "INSERT INTO users (name, email, password_hash, user_type) VALUES (?, ?, ?, 'pending')";
        connection.query(
          iquery,
          ["pending", email, "pending"],
          function (error, insertRes) {
            if (error) {
              console.log(error);
              connection.release();
              return res
                .status(501)
                .json({ success: false, message: "Database insert error." });
            }
            user_id = insertRes.insertId;
            // Continue to store verification code
            storeVerificationCode();
          }
        );
      }

      // Store verification code
      function storeVerificationCode() {
        const insertQuery =
          "INSERT INTO Email_History (user_id, email_code, email_type) VALUES (?, ?, ?)";
        connection.query(
          insertQuery,
          [user_id, emailcode, "registration"],
          function (error) {
            if (error) {
              console.log(error);
              connection.release();
              return res
                .status(503)
                .json({ success: false, message: "Database insert error." });
            }

            connection.release();
            console.log("Verification code stored:", emailcode);
            return res.status(200).json({
              success: true,
              message: "A verification code has been sent to your email.",
            });
          }
        );
      }
    });
  });
});

/**
 * Customer register with code
 */
router.post(
  "/Cregister.ajax",
  validateInput([
    validationRules.username,
    validationRules.email,
    validationRules.password,
  ]),
  function (req, res) {
    const username = req.body.user_name;
    const email = req.body.user_email;
    const password = req.body.user_password;
    const varifyEmailCode = req.body.varifyEmailCode;

    console.log("req.pool is", !!req.pool);

    if (!varifyEmailCode) {
      return res
        .status(401)
        .json({ success: false, message: "Verification code is required." });
    }
    if (!validatePassword(password)) {
      return res.status(402).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    req.pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        return res
          .status(500)
          .json({ success: false, message: "Database connection error." });
      }
      const query =
        "SELECT rh.* FROM Email_History rh JOIN users u ON rh.user_id = u.user_id WHERE u.email = ? AND rh.email_type = 'registration' AND rh.created_at >= NOW() - INTERVAL 15 MINUTE ORDER BY rh.id DESC LIMIT 1;";
      connection.query(query, [email], function (error, results) {
        if (error) {
          console.log(error);
          connection.release();
          return res
            .status(501)
            .json({ success: false, message: "Database query error." });
        }

        if (!results || results.length === 0) {
          connection.release();
          return res.status(401).json({
            success: false,
            message: "No verification code found or code expired.",
          });
        }

        if (results[0].email_code !== varifyEmailCode) {
          connection.release();
          return res
            .status(403)
            .json({ success: false, message: "Invalid verification code." });
        }

        // ok: update user & create covid status
        hashPassword(password).then((password_hash) => {
          const uquery =
            "UPDATE users SET name = ?, password_hash = ?, user_type = 'customer' WHERE email = ?";
          connection.query(
            uquery,
            [username, password_hash, email],
            function (error) {
              if (error) {
                console.log(error);
                connection.release();
                return res
                  .status(502)
                  .json({ success: false, message: "Database update error." });
              }

              const cquery =
                "INSERT INTO users_covid_status (user_id, state_name) VALUES ((SELECT user_id FROM users WHERE email = ?), 'Green')";
              connection.query(cquery, [email], function (error) {
                connection.release();
                if (error) {
                  console.log(error);
                  return res.status(504).json({
                    success: false,
                    message: "Database insert error.",
                  });
                }
                return res
                  .status(200)
                  .json({ success: true, message: "Registration successful." });
              });
            }
          );
        });
      });
    });
  }
);

/**
 * Provider email verify – send code & create pending provider
 */
router.post("/p_email_varify.ajax", function (req, res) {
  console.log("req.pool is", !!req.pool);
  const email = req.body.email;

  if (!email) {
    return res
      .status(401)
      .json({ success: false, message: "email cannot be empty." });
  }

  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: "Database connection error." });
    }
    const query = "SELECT * FROM provider WHERE email = ?";
    connection.query(query, [email], function (error, results) {
      if (error) {
        console.log(error);
        connection.release();
        return res
          .status(501)
          .json({ success: false, message: "Database query error." });
      }
      if (results && results.length > 0) {
        connection.release();
        return res
          .status(401)
          .json({ success: false, message: "Email is already registered." });
      }

      // means new email
      const emailcode = generateResetCode();

      const mailinfo = {
        from: '"SSE_G20 service" <dahaomailp2@gmail.com>',
        to: email,
        subject: "New Account Register Code",
        text: `Your Account register code is: ${emailcode}. It is valid for 15 minutes.`,
        html: `<p>Your Account register code is: <b>${emailcode}</b>. It is valid for 15 minutes.</p>`,
      };

      transporter.sendMail(mailinfo, (error) => {
        if (error) {
          console.log("Error sending email:", error);
        }
      });

      const iquery =
        "INSERT INTO provider (name, email, password_hash, user_type) VALUES (?, ?, ?, ?)";
      connection.query(
        iquery,
        ["pending", email, "pending", "pending"],
        function (error, insertRes) {
          if (error) {
            console.log(error);
            connection.release();
            return res
              .status(501)
              .json({ success: false, message: "Database insert error." });
          }

          const provider_id = insertRes.insertId;

          const insertQuery =
            "INSERT INTO P_Email_History (provider_id, email_code, email_type) VALUES (?, ?, ?)";
          connection.query(
            insertQuery,
            [provider_id, emailcode, "registration"],
            function (error) {
              if (error) {
                console.log(error);
                connection.release();
                return res
                  .status(503)
                  .json({ success: false, message: "Database insert error." });
              }
              connection.release();
              console.log("Verification code stored:", emailcode);
              return res.status(200).json({
                success: true,
                message: "A verification code has been sent to your email.",
              });
            }
          );
        }
      );
    });
  });
});

/**
 * Provider register with code + address
 */
router.post(
  "/Pregister.ajax",
  validateInput([
    validationRules.businessName,
    validationRules.email,
    validationRules.password,
    validationRules.address,
    validationRules.city,
    validationRules.state,
    validationRules.postcode,
  ]),
  function (req, res) {
    const username = req.body.provider_name;
    const email = req.body.provider_email;
    const password = req.body.provider_password;
    const varifyEmailCode = req.body.provider_varifyEmailCode;

    const address = req.body.provider_address;
    const city = req.body.provider_city;
    const state = req.body.provider_state;
    const postcode = req.body.provider_postcode;

    console.log("req.pool is", !!req.pool);

    if (!varifyEmailCode) {
      return res
        .status(401)
        .json({ success: false, message: "Verification code is required." });
    }
    if (!validatePassword(password)) {
      return res.status(402).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character.",
      });
    }

    req.pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        return res
          .status(500)
          .json({ success: false, message: "Database connection error." });
      }
      const query =
        "SELECT rh.* FROM P_Email_History rh JOIN provider p ON rh.provider_id = p.user_id WHERE p.email = ? AND rh.email_type = 'registration' AND rh.created_at >= NOW() - INTERVAL 15 MINUTE ORDER BY rh.id DESC LIMIT 1;";
      connection.query(query, [email], function (error, results) {
        if (error) {
          console.log(error);
          connection.release();
          return res
            .status(501)
            .json({ success: false, message: "Database query error." });
        }

        if (!results || results.length === 0) {
          connection.release();
          return res.status(401).json({
            success: false,
            message: "No verification code found or code expired.",
          });
        }

        if (results[0].email_code !== varifyEmailCode) {
          connection.release();
          return res
            .status(403)
            .json({ success: false, message: "Invalid verification code." });
        }

        hashPassword(password).then((password_hash) => {
          const uquery =
            "UPDATE provider SET name = ?, password_hash = ?, user_type = 'provider' WHERE email = ?";
          connection.query(
            uquery,
            [username, password_hash, email],
            function (error) {
              if (error) {
                console.log(error);
                connection.release();
                return res
                  .status(502)
                  .json({ success: false, message: "Database update error." });
              }

              const aquery =
                "INSERT INTO provider_address (provider_id, address, city, state, postcode) VALUES ((SELECT user_id FROM provider WHERE email = ?), ?, ?, ?, ?)";
              connection.query(
                aquery,
                [email, address, city, state, postcode],
                function (error) {
                  if (error) {
                    console.log(error);
                    connection.release();
                    return res.status(504).json({
                      success: false,
                      message: "Database insert error.",
                    });
                  }

                  const cquery =
                    "INSERT INTO providers_covid_status (provider_id, state_name) VALUES ((SELECT user_id FROM provider WHERE email = ?), 'Green')";
                  connection.query(cquery, [email], function (error) {
                    connection.release();
                    if (error) {
                      console.log(error);
                      return res.status(504).json({
                        success: false,
                        message: "Database insert error.",
                      });
                    }
                    return res.status(200).json({
                      success: true,
                      message: "Registration successful.",
                      redirectUrl: "/provider_login.html",
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  }
);

module.exports = router;
