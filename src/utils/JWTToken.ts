import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../Errors/UnauthorizedError.js";
import type { JwtPayload } from "jsonwebtoken";
import { string } from "zod";

export interface AuthPayload extends JwtPayload{
    id: string;
    role: "user" | "admin";
}

type JWTPayload = {
    id: string;
    role: "user" | "admin";
    selector?: string
}


const generateJWTToken = (payload: JWTPayload, secretKey: string, options: jwt.SignOptions) => {
    return jwt.sign(payload, secretKey, options)
};


const verifyJWTToken = (token: string, secretKey: string): JWTPayload =>{
    try {
        const decoded =jwt.verify(token, secretKey);

        if(typeof decoded === "string"){
            throw new UnauthorizedError("Invalid authentication token");
        }
        
        return decoded as AuthPayload;

    } catch (error) {
        throw new UnauthorizedError("Invalid or expired authentication token");
    }
}
export { generateJWTToken, verifyJWTToken }