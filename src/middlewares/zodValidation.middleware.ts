import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "../Errors/ValidationError.js";
import { log } from "node:console";

type ValidationTarget = "body" | "params" | "query";

const validateSchema = <T extends z.ZodTypeAny>(schema: T, target: ValidationTarget = "body") => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const data = req[target];
        const result = schema.safeParse(data);
        

        if (!result.success) {
            const details = result.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            }));

            return next(new ValidationError("Validation failed", details));
        }

        req[target] = result.data as Request[typeof target];
        return next();
    };
};

export { validateSchema };