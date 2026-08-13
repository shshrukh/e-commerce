import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../Errors/UnauthorizedError.js";
import { verifyJWTToken } from "../utils/JWTToken.js";
import { pool } from "../config/db.js";
import { asyncHandler } from "../handlers/AsyncHandlder.js";



const authMiddleware = asyncHandler(async(req: Request, res: Response, next: NextFunction) => {

    const authHeader = req.headers.authorization

    if (!authHeader) {
        return next(new UnauthorizedError("Authentication is required"));
    }

    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        
        throw new UnauthorizedError("Invalid authorization header");
    }

    const payload = verifyJWTToken(
        token,
        process.env.ACCESSTOKENSECRET!
    );

    const result = await pool.query<{
        id: string;
        role: "user" | "admin";
        status: "active" | "disabled";
        deleted_at: Date | null;
    }>(
        `
    SELECT id, role, status, deleted_at
    FROM users
    WHERE id = $1
    `,
        [payload.id]
    );

    const user = result.rows[0];

    if (!user) {
        
        throw new UnauthorizedError("User account does not exist");
        
    }

    if (user.deleted_at !== null) {
        
        throw new UnauthorizedError("User account has been deleted");
       
    }

    if (user.status !== "active") {
        
        throw new UnauthorizedError("User account has been disabled");
    }

    req.user = {
        id: user.id,
        role: user.role
    };

    next();
})


export { authMiddleware }