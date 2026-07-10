import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } else {
    // Dev transport: serialize the message instead of sending.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  const info = await t.sendMail({ from: config.smtp.from, to, subject, text, html });
  if (!config.smtp.host) {
    console.log('\n[email] ----------------------------------------');
    console.log(`[email] To: ${to}`);
    console.log(`[email] Subject: ${subject}`);
    console.log(`[email] ${text}`);
    console.log('[email] ----------------------------------------\n');
  }
  return info;
}

export const templates = {
  welcome: (name) => ({
    subject: 'Welcome to Viral Velocity Engine',
    text: `Hi ${name}, welcome to Viral Velocity Engine! Your free trial is active: 5 photos in the first 30 days. Start scoring your photos now.`,
  }),
  otp: (code) => ({
    subject: 'Your password reset code',
    text: `Your Viral Velocity password reset code is ${code}. It expires in ${config.otpTtlMinutes} minutes. If you did not request this, ignore this email.`,
  }),
  changePassword: (link) => ({
    subject: 'Confirm your password change',
    text: `We received a request to change your password. Confirm using this link: ${link}`,
  }),
};
