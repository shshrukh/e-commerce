
import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/JWTToken.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";




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
        const access_token = generateAccessToken({ id: userId, role }, process.env.ACCESSTOKENSECRET as string);
        const refresh_token = generateRefreshToken({ id: userId, role }, process.env.REFRESHTOKENSECRET as string);
        const hashRefreshToken = await hashSecret(refresh_token);
        const refreshTokenExpire = new Date(
            Date.now() + (7 * 24 * 60 * 60 * 1000)
        )

        const registerUser = await pool.query("INSERT INTO sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at) VALUES( $1, $2, $3, $4, $5)", [userId, hashRefreshToken, ipAddress, userAgent, refreshTokenExpire]);

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

export { loginAuthService }