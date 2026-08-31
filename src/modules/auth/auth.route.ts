import { Router } from "express";
import { validateSchema } from "../../middlewares/zodValidation.middleware.js";
import { changePasswordSchema, loginSchema } from "./auth.validator.js";
import { changePasswordController, loginAuth, refreshToken } from "./auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const authRouter = Router();


authRouter.route("/login-user").post( validateSchema(loginSchema, "body"), loginAuth);
authRouter.route("/refresh").post(refreshToken );
authRouter.route("/change-password").post( authMiddleware, validateSchema(changePasswordSchema, 'body'), changePasswordController );

export {authRouter};

