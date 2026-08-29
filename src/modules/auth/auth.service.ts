
import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateJWTToken, verifyJWTToken } from "../../utils/JWTToken.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import crypto from "node:crypto";
import type { JwtPayload } from "jsonwebtoken";





type LoginUserCredentials = {
    email: string;
    password: string;
    ip_address: string;
    device_name: string;
    location: string;
    user_agent: string;
}

type LoginResult = {
    accessToken: string;
    refreshToken: string;
};

const loginAuthService = async (payload: LoginUserCredentials): Promise<LoginResult> => {

    const { email, password, ip_address, user_agent, device_name, location } = payload

    try {

        const result = await pool.query<{ id: string, role: "user" | "admin" }>(
            `SELECT id, role FROM users WHERE email = $1`,
            [email]
        );
        
        const userRole = result.rows[0]?.role;
        const userId = result.rows[0]?.id;

        if (!userId || !userRole) {
            throw new UnauthorizedError("Invalid email or passowrd");
        }

        const credentialsResult = await pool.query<{ password_hash: string }>(
            `SELECT password_hash
            FROM user_credentials
            WHERE user_id = $1`,
            [userId]
        );
        const hash_password = credentialsResult.rows[0]?.password_hash

        if (!hash_password) {
            throw new UnauthorizedError("Invalid email");
        }

        const isPasswordCorrect = await verifySecret(password, hash_password);

        if (!isPasswordCorrect) {
            throw new UnauthorizedError("Invalid credentials");
        }


        const access_token = generateJWTToken(
            {
                id: userId,
                role: userRole
            },
            process.env.ACCESSTOKENSECRET as string,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web"
            }
        );
        const selector = crypto.randomBytes(16).toString("hex") + Date.now();
        const refresh_token = generateJWTToken(
            {
                id: userId,
                role: userRole,
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

        const registerUser = await pool.query("INSERT INTO sessions (user_id, selector, refresh_token_hash, ip_address, user_agent, device_name, location, expire_at) VALUES( $1, $2, $3, $4, $5, $6, $7, $8)", [userId, selector, hashRefreshToken, ip_address, user_agent, device_name,location, refreshTokenExpire]);

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

        throw  err;
    }
}


const refreshTokenService = async (refreshToken: string, ipAddress: string, userAgent: string): Promise<JwtPayload> => {

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
    } finally {
        client.release();
    }

};


export { loginAuthService, refreshTokenService }