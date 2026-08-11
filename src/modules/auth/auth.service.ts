import { asyncHandler } from "../../handlers/AsyncHandlder.js";
import crypto from "node:crypto";
import { pool } from "../../config/db.js";
import { email } from "zod";
import { NotFoundError } from "../../Errors/NotFoundError.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";




type loginUser = {
    email: string,
    password: string
}

const loginAuthService = async (payload: loginUser): Promise<void> => {

    const { email, password } = payload

    function comparePassword(password: string, storedPassword: string): boolean {

        const [salt, storedHash] = storedPassword.split(":");

        if (!salt || !storedHash) {
            return false;
        }
        const hash = crypto
            .pbkdf2Sync(password, salt, 100_000, 64, "sha512")
            .toString("hex");

        return crypto.timingSafeEqual(
            Buffer.from(hash, "hex"),
            Buffer.from(storedHash, "hex")
        );
    }

    try {

        const restult = await pool.query("SELECT password_hash FROM auth WHERE email = $1", [email]);

        if(restult.rowCount === 0){
            throw new NotFoundError("invalid email");
        }
        const hashPassword = restult.rows[0].password_hash;

        const isPasswordCorrect = comparePassword( password, hashPassword);
        if(!isPasswordCorrect){
            throw new UnauthorizedError("invalid credientials")
        }
        //create the access token and refresh token 

    } catch (
    ) {
        
    }
};