import type { ErrorRequestHandler } from "express";
import { AppError } from "../Errors/AppError.js";

const isProduction = process.env.NODE_ENV === "production";

const errorMiddleware: ErrorRequestHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = "Internal Server Error";
    let errorName = "UnknownError";
    let details: unknown;

    // -------------------------
    // AppError
    // -------------------------
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        errorName = err.name;
        details = err.details;
    }

    // -------------------------
    // PostgreSQL errors
    // -------------------------
    else if (err?.code) {
        errorName = "DatabaseError";

        switch (err.code) {
            case "23502":
                statusCode = 400;
                message = err.message? err.message: "A required field is missing.";
                break;

            case "23505":
                statusCode = 409;
                message = "A record with this value already exists.";
                break;

            case "23503":
                statusCode = 400;
                message = "Referenced resource does not exist.";
                break;

            case "23514":
                statusCode = 400;
                message = "Invalid data.";
                break;

            case "22P02":
                statusCode = 400;
                message = "Invalid data format.";
                break;

            default:
                statusCode = 500;
                message = "Database error.";
        }
    }

    // -------------------------
    // Normal JavaScript Error
    // -------------------------
    else if (err instanceof Error) {
        errorName = err.name;
        message = "Internal Server Error";
    }

    // -------------------------
    // Logging
    // -------------------------
    if (statusCode >= 500) {
        console.error(`[${req.method}] ${req.originalUrl}`, {
            error: errorName,
            message: err instanceof Error ? err.message : "Unknown error",
            stack:
                !isProduction && err instanceof Error
                    ? err.stack
                    : undefined,
        });
    } else {
        console.warn(`[${req.method}] ${req.originalUrl}`, {
            error: errorName,
            message,
            details,
        });
    }

    // -------------------------
    // Response
    // -------------------------
    const payload: Record<string, unknown> = {
        success: false,
        message,
    };

    if (!isProduction) {
        payload.error = errorName;

        if (details !== undefined) {
            payload.details = details;
        }

        if (err instanceof Error && err.stack) {
            payload.stack = err.stack;
        }
    }

    return res.status(statusCode).json(payload);
};

export { errorMiddleware };