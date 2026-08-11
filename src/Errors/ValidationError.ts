import { AppError } from "./AppError.js";

class ValidationError extends AppError {
    constructor(message = "Validation failed", details?: unknown) {
        super(message, 400, { details });
    }
}

export { ValidationError };