import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: Number(config.smtp.port) === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

function logMail(to, subject, text, note) {
  console.log('\n[email] ----------------------------------------');
  console.log(`[email] To: ${to}`);
  console.log(`[email] Subject: ${subject}`);
  console.log(`[email] ${text}`);
  if (note) console.log(`[email] ${note}`);
  console.log('[email] ----------------------------------------\n');
}

/** Prefer Resend HTTP API when RESEND_API_KEY is set; else SMTP / console. */
async function sendViaResend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = config.smtp.from || 'Viral Velocity <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Resend HTTP ${res.status}`);
  }
  return data;
}

export async function sendMail({ to, subject, text, html }) {
  const bodyHtml =
    html ||
    `<div style="font-family:sans-serif;line-height:1.5">
      <p>${String(text || '').replace(/\n/g, '<br/>')}</p>
    </div>`;

  try {
    if (process.env.RESEND_API_KEY) {
      const info = await sendViaResend({ to, subject, text, html: bodyHtml });
      console.log(`[email] Sent via Resend to ${to}: ${subject}`);
      return info;
    }

    const t = getTransporter();
    const info = await t.sendMail({ from: config.smtp.from, to, subject, text, html: bodyHtml });
    if (!config.smtp.host) {
      logMail(to, subject, text, 'No SMTP/Resend configured — OTP is only in Render Logs');
    } else {
      console.log(`[email] Sent via SMTP to ${to}: ${subject}`);
    }
    return info;
  } catch (err) {
    console.error('[email] Send failed:', err?.message || err);
    logMail(to, subject, text, 'FALLBACK — SMTP/Resend failed; code printed above');
    throw err;
  }
}

export const templates = {
  welcome: (name) => ({
    subject: 'Welcome to Viral Velocity Engine',
    text: `Hi ${name}, welcome to Viral Velocity Engine! Your free trial is active: 5 photos in the first 30 days. Start scoring your photos now.`,
  }),
  otp: (code) => ({
    subject: 'Your Viral Velocity verification code',
    text: `Your Viral Velocity password reset code is ${code}. It expires in ${config.otpTtlMinutes} minutes. If you did not request this, ignore this email.`,
    html: `<div style="font-family:sans-serif;max-width:420px">
      <h2 style="margin:0 0 12px">Verification code</h2>
      <p>Your Viral Velocity password reset code is:</p>
      <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>
      <p style="color:#666">Expires in ${config.otpTtlMinutes} minutes. If you did not request this, ignore this email.</p>
    </div>`,
  }),
  changePassword: (link) => ({
    subject: 'Confirm your password change',
    text: `We received a request to change your password. Confirm using this link: ${link}`,
  }),
};
