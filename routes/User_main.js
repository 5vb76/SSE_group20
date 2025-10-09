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

router.get('/', function(req, res, next) {
  res.render('index', { title: 'usermain' });
});

router.get('/signout.ajax', function(req, res, next) {
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
            return res.sendStatus(401);
        }
        res.clearCookie('sid');
        return res.status(200).json({ success: true });
    });

});

router.get('/getProvider.ajax', function(req, res) {
  console.log('req.pool is', !!req.pool);
 
   req.pool.getConnection(function(error, connection) {
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
                                'name',  name,
                                'price', price,     -- DECIMAL 保持为数值
                                'status', status
                            )
                            ) AS products
                        FROM product
                        GROUP BY provider_id
                        ) AS pa
                        ON pa.provider_id = p.user_id
                        WHERE p.user_type = 'provider';
                    `;
        connection.query(sql, function(error, results) {
            connection.release();
            if(error){
                console.log(error);
                return res.sendStatus(500);
            }
            if(!results || results.length == 0){
                return res.status(401).json({ success: false, message: 'No provider found.' });        
            }
            return res.status(200).json(results[0].providers_json);
        });
    });

});




module.exports = router;
