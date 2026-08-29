import { pool } from "../../config/db.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { hashSecret } from "../../utils/hash.js";
import type { AuthPayload } from "../../utils/JWTToken.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../../utils/uploadImageCloudinary.js";
import { NotFoundError } from "../../Errors/NotFoundError.js";
import { log } from "node:console";

type RegisterUserPayload = {
    first_name: string;
    last_name?: string;
    email: string;
    password: string;
};

type RegisteredUser = {
    id: string;
    first_name: string;
    last_name?: string | null | undefined;
    email: string;
    role: string
};

type CurrentUserDetails = {
    id: string;
    first_name: string;
    last_name: string | null;
    avatar: string | undefined;
    email: string;
}

type UpdateProfilePayload = {
    userId: string;
    image: Buffer;
}


const registerUserService = async (payload: RegisterUserPayload): Promise<RegisteredUser> => {
    const { first_name, last_name, email, password } = payload;
  
    const existingUser = await pool.query<{ id: number }>(
        "SELECT id FROM users WHERE email = $1",
        [email]
    );

    // if the user exists and email is verify then not allow if email exist not verify then we will allow. (NOTE)
    if (existingUser.rowCount && existingUser.rowCount > 0 ) {
        throw new ConflictError("User with this email already exists");
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query<RegisteredUser>(
            "INSERT INTO users (first_name, last_name, email) VALUES ($1, $2, $3) RETURNING id, first_name, last_name, role, email",
            [first_name, last_name ?? null, email]
        );

        const user = userResult.rows[0];
        console.log(user,"this is user created by ");
        
        if (!user) {
            throw new InternalServerError("Unable to create user");
        }
        
        const userId = user.id;
        const role = user.role;

        const passwordHash = await hashSecret(password);

        await client.query(
            "INSERT INTO user_credentials(user_id, password_hash) VALUES ($1, $2)",
            [userId, passwordHash]
        );

        await client.query("COMMIT");

        return {
            id: userId,
            first_name: user.first_name,
            last_name: user.last_name,
            email,
            role
        };



    } catch (error) {
        await client.query("ROLLBACK");

        throw error;
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
        u.email
        FROM users u
        WHERE u.id = $1`,
        [userId]
    )

    if (user.rowCount === 0) {
        throw new UnauthorizedError("User profile not found");
    }

    const data: CurrentUserDetails = user.rows[0];

    if(!data.avatar){
        data.avatar = data.first_name.charAt(0);
        if(data.last_name){
            data.avatar += data.last_name.charAt(0);
        }
    }
    

    return data

};

const updateProfileImageService = async (payload:UpdateProfilePayload ): Promise<void> => {
    const { userId, image } = payload;

    const userResult = await pool.query<{
        avatarPublicId: string | null;
    }>(
        `
        SELECT avatar_public_id AS "avatarPublicId"
        FROM users
        WHERE id = $1
          AND deleted_at IS NULL
        `,
        [userId],
    );

    const user = userResult.rows[0];

    if (!user) {
        throw new NotFoundError("User not found");
    };

    const oldAvatarPublicId = user.avatarPublicId;

    const newImage = await uploadImageToCloudinary(
        image,
        {
            folder: "test-my-ecommerce/users", 
        },
    );

    try {
        await pool.query(
            `
            UPDATE users
            SET
                avatar = $1,
                avatar_public_id = $2,
                updated_at = NOW()
            WHERE id = $3
            `,
            [
                newImage.secureUrl,
                newImage.publicId,
                userId,
            ],
        );

    } catch (error) {

        try {
            await deleteImageFromCloudinary(
                newImage.publicId,
            );
        } catch (cleanupError) {
            console.error(
                "Failed to cleanup newly uploaded Cloudinary image:",
                cleanupError,
            );
        }

        throw error;
    }
    if (oldAvatarPublicId) {

        try {
            await deleteImageFromCloudinary(
                oldAvatarPublicId,
            );

        } catch (cleanupError) {
            console.error(
                "Failed to delete previous avatar from Cloudinary:",
                cleanupError,
            );
        }
    }
};


export { registerUserService, getCurrentUserService, updateProfileImageService };