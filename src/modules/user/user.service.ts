import { pool } from "../../config/db.js";
import { ConflictError } from "../../Errors/ConflictError.js";
import { InternalServerError } from "../../Errors/InternalServerError.js";
import { UnauthorizedError } from "../../Errors/UnauthorizedError.js";
import { hashSecret, verifySecret } from "../../utils/hash.js";
import type { AuthPayload } from "../../utils/JWTToken.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../../utils/uploadImageCloudinary.js";
import { NotFoundError } from "../../Errors/NotFoundError.js";
import crypto from "crypto";
import { myEmitter } from "../../events/eventEmitter.js";
import { registerEmailQueue } from "../../queues/email.queue.js";
import { confirmRegistration } from "../../emails/registerationEmail.js";
import { sixDigitRendomNumber } from "../../utils/generateSixDigitNumber.js";
import { da } from "zod/locales";
import { ValidationError } from "../../Errors/ValidationError.js";

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
    avatar_url: string | undefined;
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


    if (existingUser.rowCount && existingUser.rowCount > 0) {
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
        const rendomNumber = sixDigitRendomNumber();

        const emailVerificationTokenHash = await hashSecret(rendomNumber);
        const emailTokenExp = new Date(Date.now() + 5 * 60 * 1000);
        await client.query("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
            [userId, emailVerificationTokenHash, emailTokenExp]
        );

        const html = confirmRegistration(first_name, email, rendomNumber);
        await registerEmailQueue.add(
            "register-user-email", {
            email: email,
            subject: "Welcome TO AURA NUTS",
            html
        },
            {
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 5000
                },
                removeOnComplete: true,
                removeOnFail: true
            }
        );
        await client.query("COMMIT");

        return {
            id: userId,
            email: email,
            first_name: first_name,
            last_name: last_name,
            role: role
        }

    } catch (error) {
        await client.query("ROLLBACK");

        throw error;
    } finally {
        client.release();
    }
};

const verifyEmailService = async (
    userId: string,
    code: string
): Promise<void> => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Find user and check email verification status
        const userResult = await client.query<{
            email_verified_at: Date | null;
        }>(
            `SELECT email_verified_at
             FROM users
             WHERE id = $1`,
            [userId]
        );

        const user = userResult.rows[0];

        if (!user) {
            throw new NotFoundError("User not found");
        }

        if (user.email_verified_at !== null) {
            throw new Error("Email is already verified");
        }

        // 2. Get the newest unverified OTP
        const tokenResult = await client.query<{
            user_id: string;
            token_hash: string;
            expires_at: Date;
            verified_at: Date | null;
            created_at: Date;
        }>(
            `SELECT user_id, token_hash, expires_at, verified_at, created_at
             FROM email_verification_tokens
             WHERE user_id = $1
               AND verified_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );

        const verificationToken = tokenResult.rows[0];

        if (!verificationToken) {
            throw new NotFoundError(
                "Verification code not found"
            );
        }

        // 3. Check OTP expiration
        if (Date.now() > verificationToken.expires_at.getTime()) {
            throw new ValidationError(
                "OTP is expired. Please generate a new OTP."
            );
        }

        // 4. Verify OTP
        const isOTPCorrect = await verifySecret(
            code,
            verificationToken.token_hash
        );

        if (!isOTPCorrect) {
            throw new ValidationError("The OTP is not valid");
        }

        // 5. Mark OTP as verified
        const tokenUpdateResult = await client.query(
            `UPDATE email_verification_tokens
             SET verified_at = NOW()
             WHERE id = (
                 SELECT id
                 FROM email_verification_tokens
                 WHERE user_id = $1
                   AND token_hash = $2
                   AND verified_at IS NULL
                 LIMIT 1
             )`,
            [userId, verificationToken.token_hash]
        );

        if (tokenUpdateResult.rowCount !== 1) {
            throw new InternalServerError(
                "Failed to verify the OTP"
            );
        }

        // 6. Mark user's email as verified
        const userUpdateResult = await client.query<{
            email_verified_at: Date;
        }>(
            `UPDATE users
             SET email_verified_at = NOW()
             WHERE id = $1
               AND email_verified_at IS NULL
             RETURNING email_verified_at`,
            [userId]
        );

        if (userUpdateResult.rowCount !== 1) {
            throw new InternalServerError(
                "Failed to verify the user's email"
            );
        }

        // 7. Everything succeeded
        await client.query("COMMIT");
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
        u.avatar_url,
        u.email
        FROM users AS u
        WHERE u.id = $1`,
        [userId]
    )

    if (user.rowCount === 0) {
        throw new UnauthorizedError("User profile not found");
    }

    const data: CurrentUserDetails = user.rows[0];

    if (!data.avatar_url) {
        data.avatar_url = data.first_name.charAt(0);
        if (data.last_name) {
            data.avatar_url += data.last_name.charAt(0);
        }
    }


    return data

};

const updateProfileImageService = async (payload: UpdateProfilePayload): Promise<void> => {
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
            folder: "test-my-ecommerce/users-profile",
            transformation: [
                {
                    width: 300,
                    height: 300,
                    crop: "fill",
                    gravity: "face"
                }
            ]
        }

    );

    try {
        await pool.query(
            `
            UPDATE users
            SET
                avatar_url = $1,
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


export { registerUserService, getCurrentUserService, updateProfileImageService, verifyEmailService };