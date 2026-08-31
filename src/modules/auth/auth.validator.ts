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


export const changePasswordSchema = z
    .object({
        oldPassword: z
            .string()
            .trim()
            .min(8, "Old password is required"),

        newPassword: z
            .string()
            .trim()
            .min(8, "Password must be at least 8 characters")
            .regex(/[a-z]/, "Password must contain a lowercase letter")
            .regex(/\d/, "Password must contain a number")
            .regex(
                /[!@#$%^&*]/,
                "Password must contain a special character"
            ),

        confirmPassword: z
            .string()
            .trim()
            .min(1, "Confirm password is required"),
    })
    .superRefine((data, ctx) => {
        // New password and confirmation must match
        if (data.newPassword !== data.confirmPassword) {
            ctx.addIssue({
                code: "custom",
                path: ["confirmPassword"],
                message: "Passwords do not match",
            });
        }

        // New password must be different from old password
        if (data.oldPassword === data.newPassword) {
            ctx.addIssue({
                code: "custom",
                path: ["newPassword"],
                message: "New password must be different from old password",
            });
        }
    });