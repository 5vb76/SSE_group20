const nodemailer = require('nodemailer');

// 这个是我的gmail，最好不要发太多邮件，不然会被谷歌封
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'dahaomailp2@gmail.com',
    pass: 'cdbrdvgfeldehkuc'
  }
});

module.exports = transporter;