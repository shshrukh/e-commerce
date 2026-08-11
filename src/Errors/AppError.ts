interface AppErrorOptions {
    isOperational?: boolean;
    details?: unknown;
}

abstract class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly details?: unknown;

    constructor(message: string, statusCode: number, options: AppErrorOptions = {}) {
        super(message);

        const { isOperational = true, details } = options;

        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;

        this.name = new.target.name;

        Object.setPrototypeOf(this, new.target.prototype);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, new.target);
        }
    }   

    public toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            isOperational: this.isOperational,
            details: this.details,
        };
    }
}

export { AppError };