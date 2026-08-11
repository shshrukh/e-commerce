import * as z from "zod";

export const loginSchema = z.object({
    email: z
        .email("Please enter the valid email")
        .trim()
        .toLowerCase(),
    password: z
        .string()
        .trim()
        .superRefine((password, ctx) => {
            if (password.length < 8) {
                ctx.addIssue({
                    code: "custom",
                    message: "Password must be at least 8 characters",
                });
            }

            if (!/[a-z]/.test(password)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Password must contain a lowercase letter",
                });
            }

            if (!/\d/.test(password)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Password must contain a number",
                });
            }

            if (!/[!@#$%^&*]/.test(password)) {
                ctx.addIssue({
                    code: "custom",
                    message: "Password must contain a special character",
                });
            }

        }),
});