import crypto from "crypto";
import argon2 from "argon2";
import User from "../auth/auth.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  newFamily,
  setRefreshCookie,
  clearRefreshCookie,
} from "../../utils/token.utils.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../utils/email.utils.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await User.create({
      name,
      email,
      password,
      emailVerifyToken: hashedToken,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await sendVerificationEmail(email, name, rawToken);

    const family = newFamily();
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, family);

    await _storeRefreshToken(user, refreshToken, family);
    setRefreshCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please verify your email.",
      accessToken,
      user,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select(
      "+password +refreshTokenFamily",
    );
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.isLocked()) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Account has been suspended.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    await user.resetLoginAttempts();

    const family = newFamily();
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, family);

    await _storeRefreshToken(user, refreshToken, family);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      accessToken,
      user,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
export const refresh = async (req, res) => {
  try {
    const incomingToken = req.cookies?.refreshToken;
    if (!incomingToken) {
      return res
        .status(401)
        .json({ success: false, message: "No refresh token provided" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(incomingToken);
    } catch {
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired refresh token" });
    }

    const { id: userId, family } = payload;
    const incomingHash = hashToken(incomingToken);

    const user = await User.findById(userId).select("+refreshTokenFamily");
    if (!user) {
      clearRefreshCookie(res);
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    user.pruneExpiredTokens();

    const tokenEntry = user.refreshTokenFamily.find(
      (t) => t.tokenHash === incomingHash,
    );

    if (!tokenEntry) {
      const familyExists = user.refreshTokenFamily.some(
        (t) => t.family === family,
      );
      if (familyExists) {
        user.refreshTokenFamily = user.refreshTokenFamily.filter(
          (t) => t.family !== family,
        );
        await user.save();
      }
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        message: "Refresh token reuse detected. Please log in again.",
      });
    }

    user.refreshTokenFamily = user.refreshTokenFamily.filter(
      (t) => t.tokenHash !== incomingHash,
    );

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id, family);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.refreshTokenFamily.push({
      tokenHash: hashToken(newRefreshToken),
      family,
      expiresAt,
    });

    await user.save();
    setRefreshCookie(res, newRefreshToken);

    return res.status(200).json({ success: true, accessToken: newAccessToken });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    clearRefreshCookie(res);
    if (token) {
      const tokenHash = hashToken(token);
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { refreshTokenFamily: { tokenHash } },
      });
    }
    return res
      .status(200)
      .json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout-all
// ─────────────────────────────────────────────────────────────────────────────
export const logoutAll = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $set: { refreshTokenFamily: [] },
    });
    clearRefreshCookie(res);
    return res
      .status(200)
      .json({ success: true, message: "Logged out from all devices" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=xxx
// ─────────────────────────────────────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Token is required" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerifyToken: hashedToken,
      emailVerifyExpires: { $gt: new Date() },
    }).select("+emailVerifyToken +emailVerifyExpires");

    if (!user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid or expired verification token",
        });
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-verification
// ─────────────────────────────────────────────────────────────────────────────
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email }).select(
      "+emailVerifyToken +emailVerifyExpires",
    );

    if (!user) {
      return res
        .status(200)
        .json({
          success: true,
          message: "If that email exists, a verification link has been sent",
        });
    }

    if (user.isEmailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already verified" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.emailVerifyToken = hashedToken;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(email, user.name, rawToken);

    return res
      .status(200)
      .json({ success: true, message: "Verification email sent" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(200)
        .json({
          success: true,
          message: "If that email exists, a reset link has been sent",
        });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await User.findByIdAndUpdate(user._id, {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await sendPasswordResetEmail(email, user.name, rawToken);

    return res
      .status(200)
      .json({
        success: true,
        message: "If that email exists, a reset link has been sent",
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Token and password are required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Invalidate all sessions on password reset
    await User.findByIdAndUpdate(user._id, {
      $set: { refreshTokenFamily: [] },
    });
    clearRefreshCookie(res);

    return res
      .status(200)
      .json({
        success: true,
        message: "Password reset successfully. Please log in again.",
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/change-password  (protected)
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select("+password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    // Invalidate all other sessions
    await User.findByIdAndUpdate(user._id, {
      $set: { refreshTokenFamily: [] },
    });
    clearRefreshCookie(res);

    return res
      .status(200)
      .json({
        success: true,
        message: "Password changed successfully. Please log in again.",
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper
// ─────────────────────────────────────────────────────────────────────────────
async function _storeRefreshToken(user, refreshToken, family) {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokenFamily: {
          tokenHash,
          family,
          expiresAt,
          createdAt: new Date(),
        },
      },
    },
  );
}
