import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export function signUserToken(user, remember = false) {
  return jwt.sign(
    { sub: user.user_id, kind: 'user', email: user.email },
    config.jwtSecret,
    { expiresIn: remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn }
  );
}

export function signAdminToken(admin, remember = false) {
  return jwt.sign(
    { sub: admin.admin_id, kind: 'admin', email: admin.email, role: admin.role },
    config.jwtSecret,
    { expiresIn: remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);

// 6-digit numeric code, hashed at rest (OTP & 2FA).
export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
export const hashCode = (code) => bcrypt.hash(code, 8);
export const compareCode = (code, hash) => bcrypt.compare(code, hash);

export const randomToken = () => crypto.randomBytes(24).toString('hex');
