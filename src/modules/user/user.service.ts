import { pool } from "../../config/db.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import { hashSecret } from "../../utils/hash.js";

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

export { registerUserService };