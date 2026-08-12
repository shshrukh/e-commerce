import { success } from "zod";
import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { loginAuthService } from "./auth.service.js";
import type { Request, Response } from "express";



const loginAuth = asyncHandler(async (req: Request, res: Response) =>{
    const {email, password} = req.body;
    const ipAddress = req.ip as string;
    const userAgent = req.get("User-agent") as string;
    const payload = {
        email,
        password,
        ipAddress, 
        userAgent
    }
    const result = await loginAuthService( payload );
    const {refreshToken, accessToken} = result
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({
        success: true,
        message: "user login successfully",
        data: accessToken
    });
});

export { loginAuth }