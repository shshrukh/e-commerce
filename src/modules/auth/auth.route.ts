import { Router } from "express";
import { validateSchema } from "../../middlewares/zodValidation.middleware.js";
import { loginSchema } from "./auth.validator.js";
import { loginAuth, refreshToken } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const authRouter = Router();


authRouter.route("/login-user").post( validateSchema(loginSchema, "body"), loginAuth);
authRouter.route("/refresh").post(refreshToken );

export {authRouter};

