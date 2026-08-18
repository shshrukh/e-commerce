import { Router } from "express";
import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { validateSchema } from "../../middlewares/zodValidation.middleware.js";
import { getCurrentUser, registerUser } from "./user.controller.js";
import { userDetailSchema } from "./user.validator.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const userRoute = Router();

userRoute.route("/register-user").post(validateSchema( userDetailSchema, "body"), asyncHandler(registerUser));
userRoute.route("/current-user").get( authMiddleware, getCurrentUser);

export { userRoute };