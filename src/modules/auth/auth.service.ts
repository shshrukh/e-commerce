
import { pool } from "../../config/db.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/JWTToken.js";
import { verifySecret } from "../../utils/hash.js";




type LoginUser = {
    email: string,
    password: string,
    ipAddress?: string;
    userAgent?: string;
}



const loginAuthService = async (payload: LoginUser): Promise<void> => {

    const { email, password } = payload

    try {

        const result = await pool.query(
            `SELECT a.user_id, a.email, a.password_hash, u.role FROM auth AS a JOIN users AS ON a.user_id = u.id WHERE a.email = $1`,
            [email]
        );

        if (result.rowCount === 0) {
            throw new UnauthorizedError("Invalid credentials");
        }

        const user = result.rows[0];

        const isPasswordCorrect = verifySecret(password, user.password_hash);

        if (!isPasswordCorrect) {
            throw new UnauthorizedError("Invalid credentials");
        }

        const userId = user.user_id;
        const role = user.role;
        const access_token = generateAccessToken({id: userId, role}, process.env.ACCESSTOKENSECRET as string);
        const refresh_token = generateRefreshToken({id: userId, role}, process.env.REFRESHTOKENSECRET as string);
        const hashRefreshToken = 

        await pool.query("INSERT INTO sessions (user_id, refresh_token_hash, ip-address, user-agent, expire-at) VALUES( $1, $2, $3, $4, $5)", [userId, refresh_token])



    } catch (
    ) {

    }
};