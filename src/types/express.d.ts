import type { AuthPayload } from "../utils/JWTToken.ts";


declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

export {};