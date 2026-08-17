
import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateJWTToken, verifyJWTToken } from "../../utils/JWTToken.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import crypto from "node:crypto";
import type { JwtPayload } from "jsonwebtoken";





type LoginUser = {
    email: string,
    password: string,
    ipAddress?: string;
    userAgent?: string;
}

type LoginResult = {
    accessToken: string;
    refreshToken: string;
};

const loginAuthService = async (payload: LoginUser): Promise<LoginResult> => {

    const { email, password, ipAddress, userAgent } = payload

    try {

        const result = await pool.query(
            `SELECT a.user_id, a.email, a.password_hash, u.role FROM auth AS a JOIN users AS u ON a.user_id = u.id WHERE a.email = $1`,
            [email]
        );

        if (result.rowCount === 0) {
            throw new UnauthorizedError("Invalid credentials");
        }

        const user = result.rows[0];

        const isPasswordCorrect = await verifySecret(password, user.password_hash);

        if (!isPasswordCorrect) {
            throw new UnauthorizedError("Invalid credentials");
        }

        const userId = user.user_id;
        const role = user.role;

        const access_token = generateJWTToken(
            {
                id: userId,
                role
            },
            process.env.ACCESSTOKENSECRET as string,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web"
            }
        );
        const selector = crypto.randomBytes(16).toString("hex");
        const refresh_token = generateJWTToken(
            {
                id: userId,
                role,
                selector
            },
            process.env.REFRESHTOKENSECRET as string,
            {
                expiresIn: "15d",
            }
        );

        const hashRefreshToken = await hashSecret(refresh_token);
        const refreshTokenExpire = new Date(
            Date.now() + (7 * 24 * 60 * 60 * 1000)
        )

        const registerUser = await pool.query("INSERT INTO sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at, selector) VALUES( $1, $2, $3, $4, $5, $6)", [userId, hashRefreshToken, ipAddress, userAgent, refreshTokenExpire, selector]);

        if (registerUser.rowCount === 0) {
            throw new InternalServerError("Failed to login user, plese try again letter");
        }

        return {
            accessToken: access_token,
            refreshToken: refresh_token
        }

    } catch (err) {
        if (err instanceof UnauthorizedError) {
            throw err;
        }

        if (err instanceof InternalServerError) {
            throw err;
        }

        throw new InternalServerError("Failed to login user");
    }
}


const refreshTokenService = async (refreshToken: string, ipAddress: string, userAgent: string): Promise< JwtPayload > => {

    if (!refreshToken) {
        throw new UnauthorizedError("Refresh token is required");
    }

    const JWTUser = verifyJWTToken(refreshToken, process.env.REFRESHTOKENSECRET as string);

    if (!JWTUser.id || !JWTUser.selector) {
        throw new UnauthorizedError("Invalid refresh token");
    }

    const selector = JWTUser.selector;
    const userId = JWTUser.id;

    const client = await pool.connect();

    try {

        await client.query("BEGIN");
        const sessionResult = await client.query(
            `
            SELECT
                id,
                user_id,
                selector,
                refresh_token_hash,
                expires_at,
                revoked_at
            FROM sessions
            WHERE selector = $1
              AND user_id = $2
            FOR UPDATE
            `,
            [selector, userId]
        );

        if (sessionResult.rowCount === 0) {
            throw new Error("Invalid refresh session");
        }

        const session = sessionResult.rows[0];

        if (session.revoked_at !== null) {
            throw new Error("Refresh token has been revoked");
        }
        if (new Date(session.expires_at).getTime() <= Date.now()) {
            throw new Error("Refresh token has expired");
        }

        const isValidRefreshToken = await verifySecret(
            refreshToken,
            session.refresh_token_hash
        );

        if (!isValidRefreshToken) {
            throw new Error("Invalid refresh token");
        };

        const userResult = await client.query(
            `
            SELECT
                id,
                role
            FROM users
            WHERE id = $1
              AND deleted_at IS NULL
            `,
            [userId]
        );

        if (userResult.rowCount === 0) {
            throw new Error("User not found");
        }

        const user = userResult.rows[0];

        await client.query(
            `
            UPDATE sessions
            SET
                revoked_at = NOW(),
                last_used_at = NOW()
            WHERE id = $1
            `,
            [session.id]
        );
        const newSelector = crypto
            .randomBytes(16)
            .toString("hex");

        const newRefreshToken = generateJWTToken(
            {
                id: user.id,
                role: user.role,
                selector: newSelector,
            },
            process.env.REFRESHTOKENSECRET as string,
            {
                expiresIn: "7d",
                issuer: "test-web-app",
                audience: "test-audience-web",
            }
        );

        const newRefreshTokenHash = await hashSecret(
            newRefreshToken
        );

        const newExpiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        );

        await client.query(
            `
            INSERT INTO sessions (
                user_id,
                selector,
                refresh_token_hash,
                expires_at,
                ip_address,
                user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                user.id,
                newSelector,
                newRefreshTokenHash,
                newExpiresAt,
                ipAddress,
                userAgent,
            ]
        );

        const newAccessToken = generateJWTToken(
            {
                id: user.id,
                role: user.role,
            },
            process.env.ACCESSTOKENSECRET!,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web",
            }
        );

         await client.query("COMMIT");

         return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };

    } catch (error) {
        await client.query("ROLLBACK");

        throw error;
    } finally{
        client.release();
    }

};


export { loginAuthService, refreshTokenService }