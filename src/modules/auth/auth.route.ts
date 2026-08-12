import { Router } from "express";
import { validateSchema } from "../../middlewares/zodValidation.middleware.js";
import { loginSchema } from "./auth.validator.js";
import { loginAuth } from "./auth.controller.js";

const authRouter = Router();


authRouter.route("login").post( validateSchema(loginSchema, "body"), loginAuth);

