import { pool } from "../../config/db.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { hashSecret } from "../../utils/hash.js";
import type { AuthPayload } from "../../utils/JWTToken.js";

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
    role: string
};

type CreatedUser = {
    id: number;
    first_name: string;
    last_name: string;
    role: string;
};

type CurrentUserDetails = {
    id: string;
    first_name: string;
    last_name: string;
    avatart: string | undefined;
    email: string;
 }


const registerUserService = async (payload: RegisterUserPayload): Promise<RegisteredUser> => {
    const { first_name, last_name, email, password } = payload;

    const existingUser = await pool.query<{ id: number }>(
        "SELECT id FROM auth WHERE email = $1",
        [email]
    );


    if (existingUser.rowCount && existingUser.rowCount > 0) {
        throw new ConflictError("User with this email already exists");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query<CreatedUser>(
            "INSERT INTO users (first_name, last_name) VALUES ($1, $2) RETURNING id, first_name, last_name, role",
            [first_name, last_name]
        );

        const user: CreatedUser | undefined = userResult.rows[0];

        if (!user) {
            throw new InternalServerError("Unable to create user");
        }

        const userId = user.id;
        const role = user.role;

        const passwordHash = await hashSecret(password);

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
            role
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

const getCurrentUserService = async (payload: AuthPayload): Promise<CurrentUserDetails> => {
    const userId = payload?.id;

    const user = await pool.query(
        `SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.avatar,
        a.email
        FROM users u
        JOIN auth a ON a.user_id = u.id
        WHERE u.id = $1`,
        [ userId ]
    )

    if(user.rowCount === 0){
        throw new UnauthorizedError("User profile not found");
    }

    const data: CurrentUserDetails = user.rows[0]

    return data

};

export { registerUserService, getCurrentUserService };