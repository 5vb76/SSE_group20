var express = require("express");
var router = express.Router();

const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function requireProviderSession(req, res) {
  if (!req.session || !req.session.isLoggedIn || !req.session.username) {
    res.status(401).json({ success: false, message: "Not logged in." });
    return false;
  }
  return true;
}

async function getProviderByEmail(connection, email) {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT user_id, name, email, user_type, description, created_at FROM provider WHERE email = ? LIMIT 1";
    connection.query(sql, [email], function (err, results) {
      if (err) return reject(err);
      resolve(results && results[0]);
    });
  });
}

router.get("/signout.ajax", function (req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
      return res.sendStatus(401);
    }
    res.clearCookie("sid");
    return res.status(200).json({ success: true });
  });
});

router.get("/getProviderInfo.ajax", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      const addrSql =
        "SELECT address, city, state, postcode FROM provider_address WHERE provider_id = ? ORDER BY id DESC";
      connection.query(addrSql, [provider.user_id], function (err, rows) {
        connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res
          .status(200)
          .json({ success: true, provider, address: rows || [] });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.get("/checkProviderCovidStatus", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      const sql =
        "SELECT state_name FROM providers_covid_status WHERE provider_id = ? ORDER BY id DESC LIMIT 1";
      connection.query(sql, [provider.user_id], function (err, results) {
        connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        const state = results && results[0] ? results[0].state_name : "Green";
        return res
          .status(200)
          .json({ success: true, provider: { covid_status: state } });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.get("/getProducts.ajax", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      const sql =
        "SELECT product_id, name, price, status FROM product WHERE provider_id = ? ORDER BY product_id DESC";
      connection.query(sql, [provider.user_id], function (err, rows) {
        connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res.status(200).json({ success: true, products: rows || [] });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.post("/updateProductStatus.ajax", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const { product_id, status } = req.body || {};
  if (!product_id || !status) {
    return res
      .status(400)
      .json({ success: false, message: "Missing product_id or status" });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql = "UPDATE product SET status = ? WHERE product_id = ?";
    connection.query(sql, [status, product_id], function (err, result) {
      connection.release();
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res.status(200).json({ success: true, message: "OK" });
    });
  });
});

router.get("/getOrders.ajax", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      // Return orders with customer info and latest customer covid status
      const sql = `
        SELECT
          ds.service_id,
          ds.order_timestamp,
          ds.order_status,
          ds.order_covid_status,
          ds.pickup_address,
          ds.dropoff_address,
          u.name AS customer_name,
          u.email AS customer_email,
          COALESCE(usc.state_name, 'Green') AS customer_covid_status,
          pay.amount
        FROM delivery_service ds
        JOIN users u ON ds.customer_id = u.user_id
        LEFT JOIN payment pay ON ds.payment_id = pay.payment_id
        LEFT JOIN (
          SELECT x.user_id, x.state_name
          FROM users_covid_status x
          JOIN (
            SELECT user_id, MAX(id) AS max_id
            FROM users_covid_status
            GROUP BY user_id
          ) m ON m.user_id = x.user_id AND m.max_id = x.id
        ) usc ON usc.user_id = u.user_id
        WHERE ds.provider_id = ?
        ORDER BY ds.order_timestamp DESC
        LIMIT 100`;
      connection.query(sql, [provider.user_id], function (err, rows) {
        connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res.status(200).json({ success: true, orders: rows || [] });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.post("/updateOrderStatus.ajax", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const { service_id, order_status } = req.body || {};
  if (!service_id || !order_status) {
    return res
      .status(400)
      .json({ success: false, message: "Missing service_id or order_status" });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql =
      "UPDATE delivery_service SET order_status = ? WHERE service_id = ?";
    connection.query(sql, [order_status, service_id], function (err, result) {
      connection.release();
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res.status(200).json({ success: true, message: "OK" });
    });
  });
});

router.post("/business_name_change", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const { business_name } = req.body || {};
  if (!business_name) {
    return res
      .status(400)
      .json({ success: false, message: "Business name cannot be empty." });
  }
  const email = req.session.username;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql = "UPDATE provider SET name = ? WHERE email = ?";
    connection.query(sql, [business_name, email], function (err, result) {
      connection.release();
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res.status(200).json({ success: true, message: "OK" });
    });
  });
});

router.post("/description_change", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const { description } = req.body || {};
  if (!description) {
    return res
      .status(400)
      .json({ success: false, message: "Description cannot be empty." });
  }
  const email = req.session.username;
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql = "UPDATE provider SET description = ? WHERE email = ?";
    connection.query(sql, [description, email], function (err, result) {
      connection.release();
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res.status(200).json({ success: true, message: "OK" });
    });
  });
});

router.post("/add_address", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const { address, city, state, postcode } = req.body || {};
  if (!address || !city || !state || !postcode) {
    return res.status(400).json({
      success: false,
      message: "All address fields are required.",
    });
  }
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      const insertSql =
        "INSERT INTO provider_address (provider_id, address, city, state, postcode) VALUES (?, ?, ?, ?, ?)";
      connection.query(
        insertSql,
        [provider.user_id, address, city, state, postcode],
        function (err) {
          connection.release();
          if (err) {
            console.log(err);
            return res.sendStatus(500);
          }
          return res.status(200).json({
            success: true,
            message: "Address added successfully.",
          });
        }
      );
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.get("/getemailcode", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  const code = generateResetCode();
  // Store code only; mail sending is already wired elsewhere for providers
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const sql =
      "INSERT INTO P_Email_History (provider_id, email_code, email_type) SELECT user_id, ?, 'password_reset' FROM provider WHERE email = ?";
    connection.query(sql, [code, email], function (err, result) {
      connection.release();
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      }
      return res
        .status(200)
        .json({ success: true, message: "Verification code generated." });
    });
  });
});

router.post("/password_change", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  const { password, email_code } = req.body || {};
  if (!password || !email_code) {
    return res
      .status(400)
      .json({ success: false, message: "Password and code required." });
  }
  req.pool.getConnection(function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    const validateSql =
      "SELECT rh.* FROM P_Email_History rh JOIN provider u ON rh.provider_id = u.user_id WHERE u.email = ? AND rh.email_type = 'password_reset' AND rh.email_code = ? AND TIMESTAMPDIFF(MINUTE, rh.created_at, NOW()) <= 15 ORDER BY rh.id DESC LIMIT 1";
    connection.query(validateSql, [email, email_code], function (err, rows) {
      if (err) {
        connection.release();
        console.log(err);
        return res.sendStatus(500);
      }
      if (!rows || rows.length === 0) {
        connection.release();
        return res
          .status(400)
          .json({ success: false, message: "Invalid or expired code." });
      }
      const updateSql =
        "UPDATE provider SET password_hash = ? WHERE email = ? LIMIT 1";
      connection.query(updateSql, [sha256(password), email], function (e2) {
        connection.release();
        if (e2) {
          console.log(e2);
          return res.sendStatus(500);
        }
        return res
          .status(200)
          .json({ success: true, message: "Password updated successfully." });
      });
    });
  });
});

router.post("/report_covid", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  const email = req.session.username;
  const { state_name } = req.body || {};
  if (!state_name || !["Green", "Yellow", "Red"].includes(state_name)) {
    return res.status(400).json({ success: false, message: "Invalid state." });
  }
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }
      const sql =
        "INSERT INTO providers_covid_status (provider_id, state_name) VALUES (?, ?)";
      connection.query(sql, [provider.user_id, state_name], function (err) {
        connection.release();
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }
        return res.status(200).json({ success: true, message: "OK" });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

router.get("/change_relevant_covid", function (req, res) {
  if (!requireProviderSession(req, res)) return;
  let state = String(req.query.state || "Red");
  if (!["Red", "Yellow"].includes(state)) state = "Red";
  const email = req.session.username;
  req.pool.getConnection(async function (error, connection) {
    if (error) {
      console.log(error);
      return res.sendStatus(500);
    }
    try {
      const provider = await getProviderByEmail(connection, email);
      if (!provider) {
        connection.release();
        return res
          .status(404)
          .json({ success: false, message: "Provider not found." });
      }

      // 1) find affected customers with ongoing orders
      const findSql =
        "SELECT DISTINCT u.user_id, u.name, u.email FROM delivery_service ds JOIN users u ON ds.customer_id = u.user_id WHERE ds.provider_id = ? AND ds.order_status = 'ongoing'";
      connection.query(findSql, [provider.user_id], function (err, rows) {
        if (err) {
          connection.release();
          console.log(err);
          return res.sendStatus(500);
        }
        const affected = rows || [];
        if (affected.length === 0) {
          // nothing to update; still OK
          connection.release();
          return res.status(200).json({
            success: true,
            message: "No ongoing customers to update",
            affected_customers: [],
          });
        }

        // 2) Insert Yellow status for those customers (ignore errors)
        const values = affected.map((r) => [r.user_id, "Yellow"]);
        const insertSql =
          "INSERT INTO users_covid_status (user_id, state_name) VALUES ?";
        connection.query(insertSql, [values], function (e2) {
          if (e2) console.log("insert users_covid_status warning:", e2.message);

          // 3) Update related orders' covid status to the provider's new state (Red/Yellow)
          const updSql =
            "UPDATE delivery_service SET order_covid_status=? WHERE provider_id=? AND order_status='ongoing'";
          connection.query(updSql, [state, provider.user_id], function (e3) {
            connection.release();
            if (e3) console.log("update delivery_service warning:", e3.message);
            return res.status(200).json({
              success: true,
              message:
                state === "Red"
                  ? "Affected customers set to Yellow; related orders marked Red."
                  : "Affected customers set to Yellow; related orders marked Yellow.",
              affected_customers: affected.map((r) => ({
                id: r.user_id,
                name: r.name,
                email: r.email,
              })),
            });
          });
        });
      });
    } catch (e) {
      connection.release();
      console.log(e);
      return res.sendStatus(500);
    }
  });
});

module.exports = router;
