import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import { loginAuthService, logoutService, refreshTokenService } from "./auth.service.js";
import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { UAParser } from "ua-parser-js";
import { BedRequestError } from "../../Errors/BedRequestError.js";
import { changePasswordService } from "./auth.service.js";





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


    const token = await refreshTokenService(cookieRequestToken, user_agent, device_name, location, ip_address);

    const { accessToken, refreshToken } = token;
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
        success: true,
        message: "access Token generated successfuly",
        data: { accessToken }
    });
});


const changePasswordController = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {
    const JWTPalyload = req.user;

    if (!JWTPalyload) {
        throw new UnauthorizedError("Invalid access token");
    };
    const {
        oldPassword,
        newPassword,
    } = req.body;
    const token = await changePasswordService({oldPassword, newPassword}, JWTPalyload);
    const { accessToken, refreshToken } = token;
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(200).json({
        success: true,
        message: "password change successfully",
        data: { accessToken }
    });
});

const logoutController = asyncHandler(async( req: Request, res: Response , next: NextFunction) => {

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
    const logoutController = await logoutService(cookieRequestToken, user_agent,device_name);

    res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        });

    return res.status(200).json({
        success: true,
        message: "logout successfuly",
    });
});
export { loginAuth, refreshToken, changePasswordController, logoutController }