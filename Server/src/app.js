import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import config from "./config/config.js";
import errorHandler from "./shared/middlewares/error.middleware.js";
import authRouter from "./modules/auth/auth.routes.js";
import contactRouter from "./modules/contacts/contact/contact.routes.js";
import groupRouter from "./modules/contacts/groups/group.routes.js";
import whatsappRouter from "./modules/whatsapp/whatsapp.routes.js";
import templateRouter from "./modules/templates/template.routes.js";
import campaignRouter from "./modules/campaign/campaign.routes.js";
import messageRouter from "./modules/message/message.routes.js";
import webhookRouter from "./modules/webhook/webhook.routes.js";
import analyticsRouter from "./modules/analytics/analytics.routes.js";
import planRouter from "./modules/billing/plans/plan.routes.js";
import subscriptionRouter from "./modules/billing/subscriptions/subscription.routes.js";
import paymentRouter from "./modules/billing/payments/payment.routes.js";
import billingRouter from "./modules/billing/billing.routes.js";
import settingsRouter from "./modules/settings/settings.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";
import notFound from "./shared/middlewares/notFound.middleware.js";
import conversationRouter from "./modules/conversation/conversation.routes.js";
import notificationRouter from "./modules/notifications/notification.routes.js";
import mediaRouter from "./modules/media/media.routes.js";

const app = express();

// CORS configuration
const allowedOrigins = [
  config.CLIENT_URL,
  ...(config.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "https://localhost:5173"]),
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin, curl, or a server-to-server call
      // (Meta's webhook posts with none) — never reject those.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);


// Global Middlewares 
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/groups", groupRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/templates", templateRouter);
app.use("/api/campaigns", campaignRouter);
app.use("/api/messages", messageRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/plans", planRouter);
app.use("/api/subscriptions", subscriptionRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/billing", billingRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/media", mediaRouter);

// Error handling 
app.use(notFound)
app.use(errorHandler);



export default app;