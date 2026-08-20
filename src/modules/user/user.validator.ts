import * as z from "zod";

const userDetailSchema = z.object(
    {
        first_name: z
            .string()
            .min(3, "First name should have at least 3 characters")
            .max(15, "First name should have at most 15 characters")
            .regex(/^[a-zA-Z]+$/, "First name can only contain letters")
            .toLowerCase()
            .trim(),
        last_name: z
            .string()
            .min(3, "First name should have at least 3 characters")
            .max(15, "First name should have at most 15 characters")
            .regex(/^[a-zA-Z]+$/, "First name can only contain letters")
            .toLowerCase()
            .trim()
            .optional(),
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

    }
)

export { userDetailSchema };