import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { loginAuthService, refreshTokenService } from "./auth.service.js";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";



const loginAuth = asyncHandler(async (req: Request, res: Response) => {

    const { email, password } = req.body;
    const ipAddress = req.ip as string;
    const userAgent = req.get("User-agent") as string;

    const payload = {
        email,
        password,
        ipAddress,
        userAgent
    }
    const result = await loginAuthService(payload);
    const { refreshToken, accessToken } = result
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({
        success: true,
        message: "user login successfully",
        data: { accessToken }
    });
});


const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const cookieRequestToken = req.cookies.refreshToken;

    if (!cookieRequestToken) {
        throw new UnauthorizedError("Refresh token not found");
    }
    const ipAddress = req.ip as string;
    const userAgent = req.get("User-agent") as string;

    const token = await refreshTokenService(cookieRequestToken, ipAddress, userAgent);

    const { accessToken, refreshToken } = token;
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(200).json({
        success: true,
        message: "access Token generated successfuly",
        data: { accessToken }
    });
});

export { loginAuth, refreshToken }