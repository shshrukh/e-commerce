import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateJWTToken, verifyJWTToken, type AuthPayload } from "../../utils/JWTToken.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import crypto from "node:crypto";
import { NotFoundError } from "../../Errors/NotFoundError.js";
import { BedRequestError } from "../../Errors/BedRequestError.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import type { StringValidation } from "zod/v3";



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

type changePasswordPaylod = {
    oldPassword: string;
    newPassword: string;
}

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

    if (!refreshToken) {
        throw new UnauthorizedError("Invalid refresh token");
    }

    // 1. Verify JWT signature and expiration
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

        // 2. Find and lock the session
        const sessionResult = await client.query<{
            id: string;
            user_id: string;
            selector: string;
            refresh_token_hash: string;
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
                expire_at,
                last_use_at,
                revoked_at,
                revoked_reason
            FROM sessions
            WHERE selector = $1
              AND user_id = $2
            FOR UPDATE
            `,
            [selectorId, userId]
        );

        const session = sessionResult.rows[0];

        if (!session) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        // 3. Check expiration
        if (session.expire_at <= new Date()) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        // 4. Check whether token was already used/revoked
        if (
            session.last_use_at !== null ||
            session.revoked_at !== null
        ) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        // 5. Verify the actual refresh token
        const validRefreshToken = await verifySecret(
            refreshToken,
            session.refresh_token_hash
        );

        if (!validRefreshToken) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        // 6. Get current user information from DB
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
            throw new NotFoundError("User not found");
        }

        // 7. Consume old refresh-token session
        const revokeResult = await client.query(
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

        if (revokeResult.rowCount !== 1) {
            throw new UnauthorizedError("Invalid refresh token");
        }

        // 8. Generate new access token
        const accessToken = generateJWTToken(
            {
                id: user.id,
                role: user.role,
            },
            process.env.ACCESSTOKENSECRET as string,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web",
            }
        );

        // 9. Generate new selector
        const newSelector = crypto
            .randomBytes(16)
            .toString("hex");

        // 10. Generate new refresh token
        const newRefreshToken = generateJWTToken(
            {
                id: user.id,
                role: user.role,
                selector: newSelector,
            },
            process.env.REFRESHTOKENSECRET as string,
            {
                expiresIn: "7d",
            }
        );

        // 11. Hash new refresh token
        const newRefreshTokenHash = await hashSecret(
            newRefreshToken
        );

        // 12. New session expiration
        const newExpireAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        );

        // 13. Create new session
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
                newSelector,
                newRefreshTokenHash,
                ip_address,
                user_agent,
                device_name,
                location,
                newExpireAt,
            ]
        );

        // 14. Commit rotation
        await client.query("COMMIT");

        // 15. Return new tokens
        return {
            accessToken,
            refreshToken: newRefreshToken,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;

    } finally {
        client.release();
    }
};

const changePasswordService = async (payload: changePasswordPaylod, JWTPalyload: AuthPayload): Promise<RefreshTokenResponse> => {

    const { newPassword, oldPassword } = payload;
    const { id, role } = JWTPalyload;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const userData = await client.query<{ id: string, role: "admin" | "user" }>(`SELECT id, role FROM users WHERE id  = $1`, [id]);
        const dataBaseData = userData.rows[0];

        if (!dataBaseData) {
            throw new NotFoundError("user not found");
        };

        const userCredentials = await client.query<{
            password_hash: string;
        }>(`SELECT password_hash FROM user_credentials WHERE user_id = $1`, [id]);

        const userCredentialsFromDataBase = userCredentials.rows[0];

        if (!userCredentialsFromDataBase) {
            throw new NotFoundError("user not found with these credentials");
        }

        const { password_hash } = userCredentialsFromDataBase;

        const isPasswordCorrect = await verifySecret(oldPassword, password_hash);

        if (!isPasswordCorrect) {
            // NOT mail or send the notification your want to change the passowd but credinetials are not correct
            throw new BedRequestError("passowrd is not correct");

        }

        if (oldPassword === newPassword) {
            throw new ConflictError("try new password");
        }

        const newPasswordHash = await hashSecret(newPassword);

        const updateSessionCredientials = await client.query<{ id: string }>(
            `UPDATE user_credentials
            SET password_hash = $1, password_changed_at = NOW()
            WHERE user_id = $2
            RETURNING user_id
            `,
            [newPasswordHash, id]
        )
        const updateCredentials = updateSessionCredientials.rows[0];

        if (!updateCredentials) {
            throw new Error("Internal server error")
        }

        const dataOne = await client.query<{ id: string }>(
            `UPDATE sessions
        SET revoked_at = NOW(),
        revoked_reason = 'password_changed'
        WHERE user_id = $1
        AND expire_at > NOW()
        AND revoked_at IS NULL
        RETURNING id`,
            [id]
        );
        if (dataOne.rowCount === 0) {
            throw new Error("this is first rendom error")
        }
        const accessToken = generateJWTToken(
            {
                id: dataBaseData.id,
                role: dataBaseData.role,
            },
            process.env.ACCESSTOKENSECRET as string,
            {
                expiresIn: "15m",
                issuer: "test-web-app",
                audience: "test-audience-web",
            }
        );

        // 9. Generate new selector
        const newSelector = crypto
            .randomBytes(16)
            .toString("hex");

        // 10. Generate new refresh token
        const newRefreshToken = generateJWTToken(
            {
                id: dataBaseData.id,
                role: dataBaseData.role,
                selector: newSelector,
            },
            process.env.REFRESHTOKENSECRET as string,
            {
                expiresIn: "7d",
            }
        );

        // 11. Hash new refresh token
        const newRefreshTokenHash = await hashSecret(
            newRefreshToken
        );

        // 12. New session expiration
        const newExpireAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        );
        let ipAddress;
        let userAgent;
        let deviceName;
        let location;
        // 13. Create new session
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
                dataBaseData.id,
                newSelector,
                newRefreshTokenHash,
                ipAddress ?? null,
                userAgent ?? null,
                deviceName ?? null,
                location ?? null,
                newExpireAt,
            ]
        );

        await client.query("COMMIT");

        // 15. Return new tokens
        return {
            accessToken,
            refreshToken: newRefreshToken,
        };

    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

};

const logoutService = async (
    refreshToken: string,
    user_agent: string,
    device_name: string
): Promise<void> => {
    const verifyRefreshToken = verifyJWTToken(refreshToken, process.env.REFRESHTOKENSECRET as string);;
    const {
        id,
        selector,
    } = verifyRefreshToken

    const user = await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE id = $1`,
        [id]
    )

    const isUserExists = user.rows[0];

    if(!isUserExists){
        throw new NotFoundError("user not found");
    }
    
    const sessions = await pool.query<{
        refresh_token_hash: string;
    }>(
        `SELECT refresh_token_hash FROM sessions
        WHERE user_id = $1
        AND selector = $2
        AND expire_at > NOW()
        `,
        [id, selector]
    );

    const dataBaseHashToken = sessions.rows[0];

    if(!dataBaseHashToken){
        throw new UnauthorizedError("token is not valid. login again");
    }
    const { refresh_token_hash } = dataBaseHashToken;
    const isTokenValid = await verifySecret(refreshToken, refresh_token_hash);

    if(!isTokenValid){
        throw new UnauthorizedError("token is not valid. login again");
    }

    await pool.query(
        `UPDATE sessions
        SET revoked_at = NOW(),
        revoked_reason = 'logout-device'
        WHERE user_id = $1
        AND expire_at > NOW()
        AND revoked_at IS NULL
        AND user_agent = $2
        AND device_name = $3
        RETURNING id`,
        [id, user_agent, device_name]
    )
}


export { loginAuthService, refreshTokenService, changePasswordService, logoutService };