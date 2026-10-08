import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
} from "./auth.controller.js";
import {
  protect,
  authorize,
} from "../../shared/middlewares/auth.middleware.js";
import {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
} from "../../shared/validators/auth.validator.js";

const router = Router();

// ── Rate limiters ──────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Too many attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many refresh requests" },
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many email requests, try again later",
  },
});

// ── Public routes ──────────────────────────────────────────────────────────────
router.post("/register", authLimiter, ...registerRules, validate, register);
router.post("/login", authLimiter, ...loginRules, validate, login);
router.post("/refresh", refreshLimiter, refresh);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", emailLimiter, resendVerification);
router.post(
  "/forgot-password",
  emailLimiter,
  ...forgotPasswordRules,
  validate,
  forgotPassword,
);
router.post("/reset-password", ...resetPasswordRules, validate, resetPassword);

// ── Protected routes ───────────────────────────────────────────────────────────
router.use(protect);
router.get("/me", getMe);
router.post("/logout", logout);
router.post("/logout-all", logoutAll);
router.post(
  "/change-password",
  ...changePasswordRules,
  validate,
  changePassword,
);

export default router;
