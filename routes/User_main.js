var express = require("express");
const transporter = require("./mailtest");
var router = express.Router();

const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
}

function validatePassword(password) {
  //todo: varify new password see if it matches the criteria
  return true;
}

router.get("/", function (req, res, next) {
  res.render("index", { title: "usermain" });
});

router.get("/signout.ajax", function (req, res, next) {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.sendStatus(401);
    }
    res.clearCookie("sid");
    return res.status(200).json({ success: true });
  });
});

router.get("/getProvider.ajax", function (req, res) {
  console.log("req.pool is", !!req.pool);

  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql = `         SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                'id', p.user_id,
                                'name', p.name,
                                'description', p.description,
                                'covid_status', ls.state_name,
                                'items', COALESCE(pa.products, JSON_ARRAY())
                                )
                            ) AS providers_json
                        FROM provider AS p
                        LEFT JOIN (
                        -- 取每个 provider 在 providers_covid_status 中 id 最大（最新）那条
                        SELECT pcs.provider_id, pcs.state_name
                        FROM providers_covid_status pcs
                        INNER JOIN (
                            SELECT provider_id, MAX(id) AS max_id
                            FROM providers_covid_status
                            GROUP BY provider_id
                        ) x
                            ON x.provider_id = pcs.provider_id
                        AND x.max_id = pcs.id
                        ) AS ls
                        ON ls.provider_id = p.user_id
                        LEFT JOIN (
                        
                        SELECT
                            provider_id,
                            JSON_ARRAYAGG(
                            JSON_OBJECT(
                                'id', product_id,
                                'name',  name,
                                'price', price,     
                                'status', status
                            )
                            ) AS products
                        FROM product
                        GROUP BY provider_id
                        ) AS pa
                        ON pa.provider_id = p.user_id
                        WHERE p.user_type = 'provider';
                    `;
    connection.query(sql, function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      if (!results || results.length == 0) {
        return res
          .status(401)
          .json({ success: false, message: "No provider found." });
      }
      return res.status(200).json(results[0].providers_json);
    });
  });
});

router.get("/getuserinfo.ajax", function (req, res, next) {
  //console.log('req.pool is', !!req.pool);
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = "SELECT * FROM users WHERE user_id = ?";
    connection.query(query, userId, function (error, results) {
      //connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      if (!results || results.length == 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }
      //find user address info (only one address for now)
      const addressQuery =
        "SELECT * FROM user_address WHERE user_id = ? order by id desc";
      connection.query(addressQuery, userId, function (error, addressResults) {
        connection.release();
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }
        if (addressResults && addressResults.length > 0) {
          res
            .status(200)
            .json({ success: true, user: results[0], address: addressResults });
        } else {
          res
            .status(200)
            .json({ success: true, user: results[0], address: null });
        }
      });
    });
  });
});

router.get("/check_user_covid_status", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = `
            SELECT state_name, contact_time 
            FROM users_covid_status 
            WHERE user_id = ? 
            ORDER BY contact_time DESC 
            LIMIT 1;
        `;
    connection.query(query, [userId], function (error, results) {
      //connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      if (!results || results.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No covid status found." });
      }
      // Compare contact_time
      const latest = results[0];
      // if lastest status is Green, return
      if (latest.state_name === "Green") {
        connection.release();
        req.session.user.covid_status = "Green";
        return res.status(200).json({
          success: true,
          state_name: latest.state_name,
          user: req.session.user,
        });
      } else {
        //means latest status is Yellow or Red, need to check time diff
        const diffDays =
          (new Date() - new Date(latest.contact_time)) / (1000 * 60 * 60 * 24);
        if (diffDays > 14) {
          // if more than 14 days, add new status to user_covid_status as Green
          const insertQuery =
            "INSERT INTO users_covid_status (user_id, state_name) VALUES (?, ?)";
          connection.query(
            insertQuery,
            [userId, "Green"],
            function (error, insertResults) {
              connection.release();
              if (error) {
                console.log(error);
                return res.sendStatus(500);
              }
              if (insertResults.affectedRows === 0) {
                return res.status(500).json({
                  success: false,
                  message: "Failed to update covid status.",
                });
              }
              req.session.user.covid_status = "Green";
              return res.status(200).json({
                success: true,
                state_name: "Green",
                user: req.session.user,
              });
            }
          );
        } else {
          req.session.user.covid_status = latest.state_name;
          return res.status(200).json({
            success: false,
            state_name: latest.state_name,
            user: req.session.user,
          });
        }
      }

      // if latest contact_time is more than 14 days ago, add new status as Green
    });
  });
});

router.post("/report_covid", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { state_name } = req.body;
  if (!state_name || !["Green", "Yellow", "Red"].includes(state_name)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid state name." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "INSERT INTO users_covid_status (user_id, state_name) VALUES (?, ?)";
    connection.query(query, [userId, state_name], function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      // Update session info
      req.session.user.covid_status = state_name;
      return res.status(200).json({
        success: true,
        message: "Covid status reported successfully.",
        covid_status: state_name,
        user: req.session.user,
      });
    });
  });
});

// When a user reports Red, set related providers (ongoing orders) to Yellow,
// and mark those orders' covid status as Red
router.get("/change_relevant_covid", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const covid_status = req.session.user.covid_status;
  if (covid_status === "Green") {
    // change all changed to Green
    req.pool.getConnection(function (error, connection) {
      if (error) {
        console.log(error);
        connection.release();
        return res.sendStatus(500); 
      }
      const query = `SELECT id, state_name, contact_time FROM users_covid_status WHERE user_id = ? ORDER BY id DESC LIMIT 1 OFFSET 1;`
      connection.query(query, [userId], function (err, result) {
        //connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        if (result[0].state_name == "Green" || result[0].state_name == "Yellow") {
          connection.release();
          return res.status(200).json({ success: true, message: "No need to update providers, previous status is Green or Yellow." });
        }
        const findprovider = `SELECT DISTINCT id, provider_id FROM providers_covid_status WHERE contact_time = ?`
        connection.query(findprovider, [result[0].contact_time], function (err, results) {
          if (err) {
            console.log(err);
            connection.release();
            return res.sendStatus(501);
          }
          if (results.length == 0) {
            connection.release();
            return res.status(200).json({ success: true, message: "No relevant providers found." });
          }

          const vals = results.map((r) => r.id);
          const providerIds = results.map((r) => r.provider_id);
          const insSql = `DELETE FROM providers_covid_status WHERE id IN (?)`;
          connection.query(insSql, [vals], function (err, result2) {
            if (err) {
              console.log(err);
              connection.release();
              return res.sendStatus(501);
            }
            //update history as well.
            const updSql = `UPDATE delivery_service SET order_covid_status='Green' WHERE customer_id = ? AND provider_id IN (?)`;
            connection.query(updSql, [userId, providerIds], function (err) {
              if (err) { console.log(err); }
              connection.release();
              return res.status(200).json({ success: true, message: "Providers updated to Green." });
            });

          });
        });
      });
    });
  }
  else if (covid_status === "Yellow") {
    return res.status(200).json({ success: true, message: "No need to update providers, status is Yellow." });
  }
  else{
    // change related providers to Yellow
    req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    // fix: should be recent 14 days, not ongoing.
    const findSql = `SELECT DISTINCT p.user_id, p.name, p.email
                         FROM delivery_service ds
                         JOIN provider p ON ds.provider_id = p.user_id
                         WHERE ds.customer_id = ? AND ds.order_timestamp >= NOW() - INTERVAL 14 DAY`;
    connection.query(findSql, [userId], function (err, rows) {
      if (err) {
        connection.release();
        console.log(err);
        return res.sendStatus(500);
      }
      const affected = rows || [];
      if (affected.length === 0) {
        connection.release();
        return res.status(200).json({
          success: true,
          message: "No ongoing providers to update",
          affected_providers: [],
        });
      }
      const vals = affected.map((r) => [r.user_id, "Yellow"]);
      const insSql = `INSERT INTO providers_covid_status (provider_id, state_name) VALUES ?`;
      connection.query(insSql, [vals], function (e2) {
        if (e2)
          console.log("insert providers_covid_status warning:", e2.message);
        // Orders for this user become Yellow (exposed), counterpart provider turns Yellow above
        const updSql = `UPDATE delivery_service SET order_covid_status='Yellow' WHERE customer_id = ? AND order_timestamp >= NOW() - INTERVAL 14 DAY`;
        connection.query(updSql, [userId], function (e3) {
          connection.release();
          if (e3) console.log("update delivery_service warning:", e3.message);
          return res.status(200).json({
            success: true,
            message: "Providers set to Yellow because user reported Red.",
            affected_providers: affected.map((r) => ({
              id: r.user_id,
              name: r.name,
              email: r.email,
            })),
          });
        });
      });
    });
  });

  }
});

router.post("/email_change", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { address_id, address, city, state, postcode } = req.body;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "UPDATE user_address SET address = ?, city = ?, state = ?, postcode = ? WHERE id = ? AND user_id = ?";
    connection.query(
      query,
      [address, city, state, postcode, address_id, userId],
      function (error, results) {
        connection.release();
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Address not found or not authorized.",
          });
        }
        return res
          .status(200)
          .json({ success: true, message: "Address updated successfully." });
      }
    );
  });
});

router.post("/username_change", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { username } = req.body;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = "UPDATE users SET name = ? WHERE user_id = ?";
    connection.query(query, [username, userId], function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found or not authorized.",
        });
      }
      return res
        .status(200)
        .json({ success: true, message: "Username updated successfully." });
    });
  });
});

router.get("/getemailcode", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const user_email = req.session.user.email;
  console.log("Requesting email code for user:", userId, user_email);
  const resetCode = generateResetCode();
  // todo: integrate email service to send the reset code to user's email
  const mailinfo = {
    from: "'SSE_G20 service' <dahaomailp2@gmail.com",
    to: user_email,
    subject: "Password Reset Code",
    text: `Your password reset code is: ${resetCode}. It is valid for 15 minutes.`,
    html: `<h2>Your password reset code is: <b>${resetCode}</b>. It is valid for 15 minutes.</h2>`,
  };
  transporter.sendMail(mailinfo, (error, info) => {
    if (error) {
      console.log("Error sending email:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send email." });
    }
  });
  // Store reset code in database
  var email_type = "password_reset";
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const InsertQuery =
      "Insert into Email_History (user_id, email_code, email_type) values (?, ?, ?)";
    connection.query(
      InsertQuery,
      [userId, resetCode, email_type],
      function (error, results) {
        connection.release();
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }
        console.log("Reset code stored:", resetCode);
        return res.status(200).json({
          success: true,
          message: "Verification code sent to your email.",
        });
      }
    );
  });
});

router.post("/password_change", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { password, email_code } = req.body;
  if (!validatePassword(password)) {
    return res
      .status(400)
      .json({ success: false, message: "Password does not meet criteria." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const codeQuery = `
            SELECT * FROM Email_History 
            WHERE user_id = ? 
              AND email_code = ? 
              AND email_type = ? 
              AND TIMESTAMPDIFF(MINUTE, created_at, NOW()) <= 15
            ORDER BY id DESC LIMIT 1
        `;
    connection.query(
      codeQuery,
      [userId, email_code, "password_reset"],
      function (error, results) {
        if (error) {
          connection.release();
          console.log(error);
          return res.sendStatus(500);
        }
        if (!results || results.length == 0) {
          connection.release();
          return res.status(400).json({
            success: false,
            message: "Invalid or expired verification code.",
          });
        }
        // If code is valid, proceed to update the password
        const updateQuery =
          "UPDATE users SET password_hash = ? WHERE user_id = ?";
        connection.query(
          updateQuery,
          [sha256(password), userId],
          function (error, results) {
            connection.release();
            if (error) {
              console.log(error);
              return res.sendStatus(500);
            }
            return res.status(200).json({
              success: true,
              message: "Password updated successfully.",
            });
          }
        );
      }
    );
  });
});

router.get("/get_user_history", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = `SELECT
                        ds.service_id,
                        ds.order_timestamp,
                        ds.description AS delivery_description,
                        ds.order_status,
                        ds.order_covid_status,
                        ds.pickup_address,
                        ds.dropoff_address,

                        p.user_id AS provider_id,
                        p.name AS provider_name,
                        p.email AS provider_email,
                        p.description AS provider_description,

                        pay.payment_id,
                        pay.payment_method,
                        pay.payment_status,
                        pay.amount,

                        oi.order_item_id,
                        oi.quantity,

                        prod.product_id,
                        prod.name AS product_name,
                        prod.price,
                        prod.status AS product_status

                        FROM delivery_service ds
                        JOIN provider p ON ds.provider_id = p.user_id
                        LEFT JOIN payment pay ON ds.payment_id = pay.payment_id
                        JOIN order_items oi ON ds.service_id = oi.service_id
                        JOIN product prod ON oi.product_id = prod.product_id
                        WHERE ds.customer_id = ? 
                        ORDER BY ds.order_timestamp DESC, ds.service_id, oi.order_item_id;`;
    connection.query(query, [userId], function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      if (!results || results.length == 0) {
        return res
          .status(404)
          .json({ success: false, message: "No history found." });
      }
      // If history found, return it
      return res.status(200).json({ success: true, history: results });
    });
  });
});

router.post("/add_address", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { address, city, state, postcode } = req.body;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "INSERT INTO user_address (user_id, address, city, state, postcode) VALUES (?, ?, ?, ?, ?)";
    connection.query(
      query,
      [userId, address, city, state, postcode],
      function (error, results) {
        connection.release();
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }
        return res
          .status(200)
          .json({ success: true, message: "Address added successfully." });
      }
    );
  });
});

router.post("/delete_address", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { address_id } = req.body;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query = "DELETE FROM user_address WHERE id = ? AND user_id = ?";
    connection.query(query, [address_id, userId], function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      return res
        .status(200)
        .json({ success: true, message: "Address deleted successfully." });
    });
  });
});

router.post("/checkout", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const {
    provider_id,
    cart,
    payment_method,
    dropoff_address,
    amount,
    user_id,
  } = req.body;
  var provider_address = "";
  var payment_id = 0;
  const description = "Order from user " + req.session.user.name;

  if (
    !provider_id ||
    !cart ||
    cart.length === 0 ||
    !payment_method ||
    !dropoff_address ||
    !amount
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    // Start transaction
    const insertPaymentQuery =
      "INSERT INTO payment (payment_method, payment_status, amount) VALUES (?, ?, ?)";
    connection.query(
      insertPaymentQuery,
      [payment_method, "pending", amount],
      function (error, paymentResults) {
        if (error) {
          console.log(error);
          return res.sendStatus(500);
        }
        payment_id = paymentResults.insertId;

        const findProviderQuery =
          "SELECT * FROM provider_address WHERE provider_id = ? order by id desc limit 1";
        connection.query(
          findProviderQuery,
          [provider_id],
          function (error, providerResults) {
            if (error) {
              console.log(error);
              return res.sendStatus(500);
            }
            if (!providerResults || providerResults.length === 0) {
              return connection.rollback(function () {
                connection.release();
                return res
                  .status(400)
                  .json({ success: false, message: "Invalid provider ID." });
              });
            }
            provider_address = providerResults[0].address;

            const insertServiceQuery = `INSERT INTO delivery_service 
                        (provider_id, customer_id, payment_id, order_timestamp, description, order_status, order_covid_status, pickup_address, dropoff_address) 
                        VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?)`;
            connection.query(
              insertServiceQuery,
              [
                provider_id,
                user_id,
                payment_id,
                description,
                "ongoing",
                "Green",
                provider_address,
                dropoff_address,
              ],
              function (error, serviceResults) {
                if (error) {
                  console.log(error);
                  return res.sendStatus(500);
                }
                // add to order_items
                const service_id = serviceResults.insertId;
                console.log("Service ID:", service_id);
                const insertOrderItemsQuery =
                  "INSERT INTO order_items (service_id, product_id, quantity) VALUES ?";
                const orderItemsData = cart.map((item) => [
                  service_id,
                  item.id,
                  item.qty,
                ]);
                connection.query(
                  insertOrderItemsQuery,
                  [orderItemsData],
                  function (error, orderItemsResults) {
                    if (error) {
                      console.log(error);
                      return res.sendStatus(500);
                    }

                    res
                      .status(200)
                      .json({ success: true, message: "Checkout successful." });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

router.post("/report_covid", function (req, res) {
  if (!req.session.isLoggedIn) {
    return res.status(401).json({ success: false, message: "Not logged in." });
  }
  const userId = req.session.user.id;
  const { state_name } = req.body;
  if (!state_name || !["Green", "Yellow", "Red"].includes(state_name)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid state name." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const query =
      "INSERT INTO users_covid_status (user_id, state_name) VALUES (?, ?)";
    connection.query(query, [userId, state_name], function (error, results) {
      connection.release();
      if (error) {
        console.log(error);
        return res.sendStatus(500);
      }
      // Update session info
      req.session.user.covid_status = state_name;
      return res.status(200).json({
        success: true,
        message: "Covid status reported successfully.",
        covid_status: state_name,
        user: req.session.user,
      });
    });
  });
});

module.exports = router;
