import express from "express";
import type { Express } from "express";
import cors from "cors";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { userRoute } from "./modules/user/user.route.js";
import { authRouter } from "./modules/auth/auth.route.js";

const app: Express = express();

// using the cors middleware.
app.use(cors());

// converting the json into js object
app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/users", userRoute);
app.use("/api/v1/auth", authRouter);

// Error middleware
app.use(errorMiddleware);

export { app };
