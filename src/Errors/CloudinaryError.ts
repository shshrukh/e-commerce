import { AppError } from "./AppError.js";

export class CloudinaryError extends AppError {

    constructor(
        message = "Cloudinary operation failed",
        details?: unknown,
    ) {
        super(message, 502, {
            details,
        });
    }
}