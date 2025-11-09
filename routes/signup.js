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

// Ensure customer signup fields are compatible with validator expectations
function mapCustomerSignupFields(req, res, next) {
  if (req.body.user_name && req.body.username === undefined) {
    req.body.username = req.body.user_name;
  }
  if (req.body.user_email && req.body.email === undefined) {
    req.body.email = req.body.user_email;
  }
  if (req.body.user_password && req.body.password === undefined) {
    req.body.password = req.body.user_password;
  }
  next();
}

// Ensure provider signup fields are compatible with validator expectations
function mapProviderSignupFields(req, res, next) {
  if (req.body.provider_name && req.body.business_name === undefined) {
    req.body.business_name = req.body.provider_name;
  }
  if (req.body.provider_email && req.body.email === undefined) {
    req.body.email = req.body.provider_email;
  }
  if (req.body.provider_password && req.body.password === undefined) {
    req.body.password = req.body.provider_password;
  }
  if (req.body.provider_address && req.body.address === undefined) {
    req.body.address = req.body.provider_address;
  }
  if (req.body.provider_city && req.body.city === undefined) {
    req.body.city = req.body.provider_city;
  }
  if (req.body.provider_state && req.body.state === undefined) {
    req.body.state = req.body.provider_state;
  }
  if (req.body.provider_postcode && req.body.postcode === undefined) {
    req.body.postcode = req.body.provider_postcode;
  }
  next();
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

      const storeCode = (userId) => {
        const insertQuery =
          "INSERT INTO Email_History (user_id, email_code, email_type) VALUES (?, ?, ?)";
        connection.query(
          insertQuery,
          [userId, emailcode, "registration"],
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
      };

      if (results && results.length > 0) {
        const existingUser = results[0];
        if (existingUser.user_type !== "pending") {
          connection.release();
          return res
            .status(401)
            .json({ success: false, message: "Email is already registered." });
        }
        // Reuse existing pending user instead of inserting a duplicate row
        return storeCode(existingUser.user_id);
      }

      // New email: insert a pending user shell then store the verification code
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

          const user_id = insertRes.insertId;
          storeCode(user_id);
        }
      );
    });
  });
});

/**
 * Customer register with code
 */
router.post(
  "/Cregister.ajax",
  mapCustomerSignupFields,
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

      const storeCode = (providerId) => {
        const insertQuery =
          "INSERT INTO P_Email_History (provider_id, email_code, email_type) VALUES (?, ?, ?)";
        connection.query(
          insertQuery,
          [providerId, emailcode, "registration"],
          function (error) {
            if (error) {
              console.log(error);
              connection.release();
              return res
                .status(503)
                .json({ success: false, message: "Database insert error." });
            }
            connection.release();
            console.log("Provider verification code stored:", emailcode);
            return res.status(200).json({
              success: true,
              message: "A verification code has been sent to your email.",
            });
          }
        );
      };

      if (results && results.length > 0) {
        const existingProvider = results[0];
        if (existingProvider.user_type !== "pending") {
          connection.release();
          return res.status(401).json({
            success: false,
            message: "Email is already registered.",
          });
        }
        return storeCode(existingProvider.user_id);
      }

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
          storeCode(provider_id);
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
  mapProviderSignupFields,
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
          const fetchProviderSql =
            "SELECT user_id FROM provider WHERE email = ? LIMIT 1";
          connection.query(
            fetchProviderSql,
            [email],
            function (error, providerRows) {
              if (error) {
                connection.release();
                console.log(error);
                return res.status(502).json({
                  success: false,
                  message: "Failed to load provider information.",
                });
              }
              const providerId =
                providerRows && providerRows[0] && providerRows[0].user_id;

              const updateProvider = (targetProviderId) => {
                const uquery =
                  "UPDATE provider SET name = ?, password_hash = ?, user_type = 'provider' WHERE user_id = ?";
                connection.query(
                  uquery,
                  [username, password_hash, targetProviderId],
                  function (error) {
                    if (error) {
                      console.log(error);
                      connection.release();
                      return res.status(502).json({
                        success: false,
                        message: "Database update error.",
                      });
                    }

                    const deleteAddressSql =
                      "DELETE FROM provider_address WHERE provider_id = ?";
                    connection.query(
                      deleteAddressSql,
                      [targetProviderId],
                      function (error) {
                        if (error) {
                          console.log(error);
                          connection.release();
                          return res.status(504).json({
                            success: false,
                            message: "Database delete error.",
                          });
                        }

                        const insertAddressSql =
                          "INSERT INTO provider_address (provider_id, address, city, state, postcode) VALUES (?, ?, ?, ?, ?)";
                        connection.query(
                          insertAddressSql,
                          [targetProviderId, address, city, state, postcode],
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
                              "INSERT INTO providers_covid_status (provider_id, state_name) VALUES (?, 'Green')";
                            connection.query(
                              cquery,
                              [targetProviderId],
                              function (error) {
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
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              };

              if (providerId) {
                updateProvider(providerId);
              } else {
                const createProviderSql =
                  "INSERT INTO provider (name, email, password_hash, user_type) VALUES (?, ?, ?, 'provider')";
                connection.query(
                  createProviderSql,
                  [username, email, password_hash],
                  function (error, insertRes) {
                    if (error) {
                      connection.release();
                      console.log(error);
                      return res.status(502).json({
                        success: false,
                        message: "Failed to create provider record.",
                      });
                    }
                    updateProvider(insertRes.insertId);
                  }
                );
              }
            }
          );
        });
      });
    });
  }
);

module.exports = router;
