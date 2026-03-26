const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.MAIL_HOST;
  const port = process.env.MAIL_PORT;
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  if (!host || !user || !pass) {
    console.warn('Mail config missing (MAIL_HOST, MAIL_USER, MAIL_PASS). OTP emails will not be sent.');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: parseInt(port, 10) || 587,
    secure: false,
    auth: { user, pass },
  });
  return transporter;
}

async function sendOTPEmail(to, otp) {
  const t = getTransporter();
  if (!t) return { sent: false, error: 'Email not configured' };
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to,
      subject: 'Verify your email - AI Based Cross Platform Clipboard System',
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

module.exports = { sendOTPEmail, getTransporter };
