import { Router } from "express";
import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { validateSchema } from "../../middlewares/zodValidation.middleware.js";
import { registerUser } from "./user.controller.js";
import { userDetailSchema } from "./user.validator.js";

const userRoute = Router();

userRoute.route("/register-user").post(validateSchema( userDetailSchema, "body"), asyncHandler(registerUser));

export { userRoute };