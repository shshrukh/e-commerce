import type { NextFunction, Request, Response } from "express";
import { getCurrentUserService, registerUserService } from "./user.service.js";
import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";

const registerUser = async (req: Request, res: Response) => {
    const user = await registerUserService(req.body);

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: user,
    });
};

const getCurrentUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.user;
    if (!payload){
        throw new UnauthorizedError("You are not authenticated");
    }

    const data = await getCurrentUserService(payload);
    res.status(201).json({
        success: true,
        message: "Current user retrieved successfully",
        data: {data}
    });
});

export { registerUser , getCurrentUser };