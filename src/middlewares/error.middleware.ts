import type { ErrorRequestHandler } from "express";
import { AppError } from "../Errors/AppError.js";

const isProduction = process.env.NODE_ENV === "production";

const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : "Internal Server Error";
    const errorName = err instanceof Error ? err.name : "UnknownError";

    if (statusCode >= 500) {
        console.error(`[${req.method}] ${req.originalUrl}`, {
            error: errorName,
            message: err instanceof Error ? err.message : "Unknown error",
            stack: isProduction ? undefined : err instanceof Error ? err.stack : undefined,
        });
    } else {
        console.warn(`[${req.method}] ${req.originalUrl}`, {
            error: errorName,
            message,
            details: err instanceof AppError ? err.details : undefined,
        });
    }

    const payload: Record<string, unknown> = {
        success: false,
        message,
    };

    if (!isProduction) {
        payload.error = errorName;

        if (err instanceof AppError && err.details !== undefined) {
            payload.details = err.details;
        }

        if (err instanceof Error && err.stack) {
            payload.stack = err.stack;
        }
    }

    res.status(statusCode).json(payload);
};

export { errorMiddleware };