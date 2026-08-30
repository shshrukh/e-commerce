
import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateJWTToken, verifyJWTToken } from "../../utils/JWTToken.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import crypto from "node:crypto";
import type { JwtPayload } from "jsonwebtoken";
import { NotFoundError } from "../../Errors/NotFoundError.js";




type UserRole = "user" | "admin";
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
type RefreshTokenResponse = {
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
        const selector = crypto.randomBytes(16).toString("hex");
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

        const registerUser = await pool.query("INSERT INTO sessions (user_id, selector, refresh_token_hash, ip_address, user_agent, device_name, location, expire_at) VALUES( $1, $2, $3, $4, $5, $6, $7, $8)", [userId, selector, hashRefreshToken, ip_address, user_agent, device_name, location, refreshTokenExpire]);

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

        throw err;
    }
}


const refreshTokenService = async (
    refreshToken: string,
    user_agent: string,
    device_name: string,
    location: string,
    ip_address: string
): Promise<RefreshTokenResponse> => {

    // 1. Check refresh token
    if (!refreshToken) {
        throw new UnauthorizedError("Refresh token is required");
    }

    // 2. Verify JWT
    const JWTUser = verifyJWTToken(
        refreshToken,
        process.env.REFRESHTOKENSECRET as string
    );

    if (!JWTUser.id || !JWTUser.selector) {
        throw new UnauthorizedError("Invalid refresh token");
    }

    const userId = JWTUser.id;
    const selectorId = JWTUser.selector;

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 3. Find session
        const sessionData = await client.query<{
            id: string;
            user_id: string;
            selector: string;
            refresh_token_hash: string;
            ip_address: string | null;
            user_agent: string | null;
            device_name: string | null;
            location: string | null;
            expire_at: Date;
            last_use_at: Date | null;
            revoked_at: Date | null;
            revoked_reason: string | null;
        }>(
            `
            SELECT
                id,
                user_id,
                selector,
                refresh_token_hash,
                ip_address,
                user_agent,
                device_name,
                location,
                expire_at,
                last_use_at,
                revoked_at,
                revoked_reason
            FROM sessions
            WHERE selector = $1
              AND user_id = $2
            `,
            [selectorId, userId]
        );

        const session = sessionData.rows[0];

        if (!session) {
            throw new UnauthorizedError(
                "Invalid refresh token"
            );
        }

        // 4. Check expiration
        if (session.expire_at <= new Date()) {
            throw new UnauthorizedError(
                "Refresh token is expired. Please login again"
            );
        }

        // 5. Check if already used
        if (session.last_use_at !== null) {
            throw new UnauthorizedError(
                "Refresh token has already been used. Please login again"
            );
        }

        // 6. Check if revoked
        if (session.revoked_at !== null) {
            throw new UnauthorizedError(
                "Refresh token has already been revoked. Please login again"
            );
        }

        // 7. Verify refresh token against stored hash
        const isValidToken = await verifySecret(
            refreshToken,
            session.refresh_token_hash
        );

        if (!isValidToken) {
            throw new UnauthorizedError(
                "Invalid refresh token"
            );
        }

        // 8. Get current user
        const userResult = await client.query<{
            id: string;
            role: UserRole;
        }>(
            `
            SELECT id, role
            FROM users
            WHERE id = $1
            `,
            [userId]
        );

        const user = userResult.rows[0];

        if (!user) {
            throw new NotFoundError(
                "User not found"
            );
        }

        // 9. Atomically consume old session
        const revokedSession = await client.query(
            `
            UPDATE sessions
            SET
                last_use_at = NOW(),
                revoked_at = NOW(),
                revoked_reason = 'refresh_token_rotation'
            WHERE id = $1
              AND revoked_at IS NULL
              AND last_use_at IS NULL
            RETURNING id
            `,
            [session.id]
        );

        if (revokedSession.rowCount !== 1) {
            throw new UnauthorizedError(
                "Refresh token has already been used or revoked"
            );
        }

        // 10. Generate new access token
        const access_token = generateJWTToken(
            {
                id: user.id,
                role: user.role
            },
            process.env.ACCESSTOKENSECRET as string,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web"
            }
        );

        // 11. Generate new refresh-token selector
        const selector = crypto
            .randomBytes(16)
            .toString("hex");

        // 12. Generate new refresh token
        const newRefreshToken = generateJWTToken(
            {
                id: user.id,
                role: user.role,
                selector
            },
            process.env.REFRESHTOKENSECRET as string,
            {
                expiresIn: "7d"
            }
        );

        // 13. Hash new refresh token
        const newRefreshTokenHash = await hashSecret(
            newRefreshToken
        );

        // 14. Database expiration
        const refreshTokenExpire = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        );

        // 15. Create new session
        await client.query(
            `
            INSERT INTO sessions (
                user_id,
                selector,
                refresh_token_hash,
                ip_address,
                user_agent,
                device_name,
                location,
                expire_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
                user.id,
                selector,
                newRefreshTokenHash,
                ip_address,
                user_agent,
                device_name,
                location,
                refreshTokenExpire
            ]
        );

        // 16. Commit everything
        await client.query("COMMIT");

        // 17. Return new tokens
        return {
            accessToken: access_token,
            refreshToken: newRefreshToken
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
};


export { loginAuthService, refreshTokenService }