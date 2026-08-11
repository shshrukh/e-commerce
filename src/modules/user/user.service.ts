import crypto from "node:crypto";
import { pool } from "../../config/db.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";

type RegisterUserPayload = {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
};

type RegisteredUser = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
};

const hashPassword = (password: string): string => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");

    return `${salt}:${hash}`;
};

const registerUserService = async (payload: RegisterUserPayload): Promise<RegisteredUser> => {
    const { first_name, last_name, email, password } = payload;

    const existingUser = await pool.query<{ id: number }>(
        "SELECT id FROM auth WHERE email = $1",
        [email]
    );
    console.log(existingUser);
    

    if (existingUser.rowCount && existingUser.rowCount > 0) {
        throw new ConflictError("User with this email already exists");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query<{ id: number }>(
            "INSERT INTO users (first_name, last_name) VALUES ($1, $2) RETURNING id",
            [first_name, last_name]
        );

        const userId = userResult.rows[0]?.id;

        if (!userId) {
            throw new InternalServerError("Unable to create user");
        }

        const passwordHash = hashPassword(password);

        await client.query(
            "INSERT INTO auth (user_id, email, password_hash) VALUES ($1, $2, $3)",
            [userId, email, passwordHash]
        );

        await client.query("COMMIT");

        return {
            id: userId,
            first_name,
            last_name,
            email,
        };
    } catch (error) {
        await client.query("ROLLBACK");

        if (error instanceof ConflictError) {
            throw error;
        }

        if (error instanceof Error && "code" in error && error.code === "23505") {
            throw new ConflictError("User with this email already exists");
        }

        throw new InternalServerError("Failed to register user");
    } finally {
        client.release();
    }
};

export { registerUserService };