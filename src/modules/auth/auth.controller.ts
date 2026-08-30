import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { loginAuthService, refreshTokenService } from "./auth.service.js";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { UAParser } from "ua-parser-js";
import { BedRequestError } from "../../Errors/BedRequestError.js";





const loginAuth = asyncHandler(async (req: Request, res: Response) => {

    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
        throw new BedRequestError("email or password are missing")
    }
    const ip_address = req.ip;

    if (!ip_address) {
        throw new UnauthorizedError("Ip address is invalid or can't get the ip address")
    }

    const user_agent = req.get("User-agent") ?? "Unknown";
    const parser = new UAParser(user_agent)
    const browser = parser.getBrowser().name ?? "Unknown Browser";
    const os = parser.getOS().name ?? "Unknown OS";
    const device_name = `${browser} on ${os}`;
    const location = "Unknown";

    const payload = {
        email,
        password,
        ip_address,
        device_name,
        location,
        user_agent,
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
    const ip_address = req.ip ?? "Unknown"
    const user_agent = req.get("User-agent") ?? "Unknown";
    const parser = new UAParser(user_agent)
    const browser = parser.getBrowser().name ?? "Unknown Browser";
    const os = parser.getOS().name ?? "Unknown OS";
    const device_name = `${browser} on ${os}`;
    const location: string = "Unknown";

    const cookieRequestToken = req.cookies.refreshToken;

    if (typeof cookieRequestToken !== "string") {
        throw new UnauthorizedError("Refresh token not found");
    }
   
    
    const token = await refreshTokenService(cookieRequestToken, user_agent, device_name, location, ip_address );

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