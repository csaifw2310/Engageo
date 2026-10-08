import express from "express";

import { protect } from "../../shared/middlewares/auth.middleware.js";
import validate from "../../shared/middlewares/validate.middleware.js";
import * as controller from "./whatsapp.controller.js";
import * as v from "../../shared/validators/whatsapp.validator.js";

const whatsappRouter = express.Router();

// Every WhatsApp route requires an authenticated tenant.
whatsappRouter.use(protect);

whatsappRouter.post("/connect", v.connect, validate, controller.connect);
whatsappRouter.get("/status", controller.getStatus);
whatsappRouter.get("/me", controller.getConnection);
whatsappRouter.post("/disconnect", controller.disconnect);
whatsappRouter.post("/sync", controller.sync);
whatsappRouter.post("/connect-meta", v.exchangeCode, validate, controller.exchangeCode);


export default whatsappRouter;
