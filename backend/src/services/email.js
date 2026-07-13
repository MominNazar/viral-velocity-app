import nodemailer from 'nodemailer';
import dns from 'node:dns';
import { config } from '../config.js';

// Prefer IPv4 — Render free often fails Gmail SMTP over IPv6 (ENETUNREACH)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node */
}

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: Number(config.smtp.port) === 465,
      // Render free frequently blocks outbound :587; 465 sometimes works when 587 does not
      requireTLS: Number(config.smtp.port) === 587,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      family: 4, // force IPv4
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      tls: { servername: config.smtp.host },
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

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || config.smtp.host);
}

/** Resend HTTP API — works on Render free (uses HTTPS, not blocked SMTP ports). */
async function sendViaResend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || config.smtp.from || 'Viral Velocity <onboarding@resend.dev>';
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
  if (!emailConfigured()) {
    logMail(to, subject, text, 'No RESEND_API_KEY or SMTP_* configured');
    const err = new Error(
      'Email is not configured. On Render free tier prefer RESEND_API_KEY (HTTPS). SMTP to Gmail often times out.'
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  const bodyHtml =
    html ||
    `<div style="font-family:sans-serif;line-height:1.5">
      <p>${String(text || '').replace(/\n/g, '<br/>')}</p>
    </div>`;

  // Prefer Resend on cloud hosts — SMTP ports are often blocked
  if (process.env.RESEND_API_KEY) {
    try {
      const info = await sendViaResend({ to, subject, text, html: bodyHtml });
      console.log(`[email] Sent via Resend to ${to}: ${subject}`);
      return info;
    } catch (err) {
      console.error('[email] Resend failed:', err.message);
      if (!config.smtp.host) {
        logMail(to, subject, text, 'Resend failed; code printed above');
        throw err;
      }
      console.warn('[email] Falling back to SMTP…');
    }
  }

  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: process.env.MAIL_FROM || config.smtp.from,
      to,
      subject,
      text,
      html: bodyHtml,
    });
    console.log(`[email] Sent via SMTP to ${to}: ${subject}`);
    return info;
  } catch (err) {
    console.error('[email] Send failed:', err?.message || err);
    logMail(
      to,
      subject,
      text,
      'SMTP failed (common on Render free). Add RESEND_API_KEY — see docs. Code printed above for debugging.'
    );
    const e = new Error(
      'Could not reach the mail server. On Render free, use Resend (RESEND_API_KEY) instead of Gmail SMTP.'
    );
    e.code = 'EMAIL_SEND_FAILED';
    throw e;
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
