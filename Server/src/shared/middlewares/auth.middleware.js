import { verifyAccessToken } from "../../utils/token.utils.js";
import ApiError from "../../utils/ApiError.js";

// ── Protect routes — validates Bearer access token ────────────────────────────
export const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(new ApiError(401, "No access token provided"));
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    if (!decoded?.id) {
      return next(new ApiError(401, "Invalid token payload"));
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError"
        ? "Access token expired"
        : "Invalid access token";
    return next(new ApiError(401, message));
  }
};

// ── Role-based access control ─────────────────────────────────────────────────
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(
        new ApiError(
          403,
          `Role '${req.user?.role}' is not authorized for this resource`,
        ),
      );
    }
    next();
  };

// ── Default export — alias for protect (used by contacts/groups routes) ───────
export default protect;
