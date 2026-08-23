import type { NextFunction, Request, Response } from "express";
import { getCurrentUserService, registerUserService } from "./user.service.js";
import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { BedRequestError } from "../../Errors/BedRequestError.js";
import { updateProfileImageService } from "./user.service.js";

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

    const currentUser = await getCurrentUserService(payload);
    res.status(201).json({
        success: true,
        message: "Current user retrieved successfully",
        data: {currentUser}
    });
});

const updateProfileUser = asyncHandler( async(req: Request, res: Response, next: NextFunction) => {
    const image = req.file?.buffer;
    const userId = req.user?.id;

    if(!image ){
        throw new BedRequestError("Image is required");
    }
    if(!userId){
        throw new UnauthorizedError("Invalid user")
    }

    const payload = {
        image,
        userId
    }

    await updateProfileImageService(payload);
    res.status(201).json({
        success: true,
        message: "Profile image is uploaded successfully",
        
    });

});

export { registerUser , getCurrentUser, updateProfileUser };