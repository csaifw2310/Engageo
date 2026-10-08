import dotenv from "dotenv"
dotenv.config()

if(!process.env.PORT) {
    throw new Error("Port not found in env")
}

if(!process.env.MONGODB_URI) {
    throw new Error("MongoDB URI not found in env variables")
}

if(!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT Access Secret not found in env variables")
}

if(!process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT Refresh Secret not found in env variables")
}

if(!process.env.JWT_ACCESS_EXPIRES_IN) {
    console.warn("JWT Access Expiration not set in env variables. Defaulting to 15m");
}

if(!process.env.JWT_REFRESH_EXPIRES_IN) {
    console.warn("JWT Refresh Expiration not set in env variables. Defaulting to 7d");
}

if(!process.env.CLIENT_URL) {
    throw new Error("Client URL not found in env variables")
}

if(!process.env.EMAIL_FROM) {
    throw new Error("Email From address not found in env variables")
}

if(!process.env.RESEND_API_KEY) {
    throw new Error("Resend API Key not found in env variables")
}

if(!process.env.NODE_ENV) {
    console.warn("NODE_ENV not set in env variables. Defaulting to 'development'");
}

if(!process.env.META_APP_ID) {
    throw new Error("Meta app id not found in envirnmental variables")
}

if(!process.env.META_APP_SECRET) {
    throw new Error("Meta app secret not found in envirnmental variables")
}

if(!process.env.META_GRAPH_API_VERSION) {
    throw new Error("Meta graph api version not found in envirnmental variables")
}

// ── Razorpay (Billing module) ────────────────────────────────────────────────
// Optional: the billing module imports and runs without these, returning a 503
// from paid flows until they are configured. Warn rather than throw so the rest
// of the platform boots in environments where billing is not yet wired up.
if(!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn("Razorpay API keys not set — paid subscription flows will be unavailable until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured.");
}

if(!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.warn("RAZORPAY_WEBHOOK_SECRET not set — Razorpay webhooks will be rejected until it is configured.");
}

if(!process.env.META_REDIRECT_URI) {
    console.warn("META_REDIRECT_URI not set — Meta OAuth flows will be unavailable until it is configured.");
}

// Optional: only the template header-media upload needs this. It must be a
// System User token from the Business Manager that OWNS the Meta app, because
// the Resumable Upload edge lives on the app object:
//   • the embedded-signup token belongs to the customer's business, so it
//     cannot load the app  -> "Object with ID '<app-id>' does not exist"
//   • an app access token ("{id}|{secret}") is refused outright
//     -> OAuthException code 200, "API access blocked."
if(!process.env.META_SYSTEM_USER_TOKEN) {
    console.warn("META_SYSTEM_USER_TOKEN not set — template header media (image/video/document) cannot be uploaded until it is configured. Text-only templates are unaffected.");
}

if(!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.warn("Cloudinary credentials not set — file uploads will be unavailable until CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are configured.");
}


const config = {
    PORT: process.env.PORT || 4000,
    MONGODB_URI : process.env.MONGODB_URI,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    CLIENT_URL: process.env.CLIENT_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NODE_ENV: process.env.NODE_ENV || 'development',
    META_APP_ID: process.env.META_APP_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_GRAPH_API_VERSION: process.env.META_GRAPH_API_VERSION,
    META_SYSTEM_USER_TOKEN: process.env.META_SYSTEM_USER_TOKEN || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
    META_REDIRECT_URI: process.env.META_REDIRECT_URI || '',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
}

export default config;