import type { Request, Response } from "express";
import { registerUserService } from "./user.service.js";

const registerUser = async (req: Request, res: Response) => {
    const user = await registerUserService(req.body);

    res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: user,
    });
};

export { registerUser };