import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.js';

// ── Token generation ───────────────────────────────────────────────────────────
export const generateAccessToken = (userId, role) =>
  jwt.sign({ id: userId, role }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES || '15m',
  });

export const generateRefreshToken = (userId, family) =>
  jwt.sign({ id: userId, family }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES || '7d',
  });

// ── Token verification ─────────────────────────────────────────────────────────
export const verifyAccessToken = (token) =>
  jwt.verify(token, config.JWT_ACCESS_SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, config.JWT_REFRESH_SECRET);

// ── Hash a refresh token for safe DB storage ───────────────────────────────────
export const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// ── Create a unique token family ID ───────────────────────────────────────────
export const newFamily = () => crypto.randomUUID();

// ── Cookie helpers ─────────────────────────────────────────────────────────────
export const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
  });
};