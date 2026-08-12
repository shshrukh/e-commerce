import jwt from "jsonwebtoken";
import { verify } from "node:crypto";

type JWTPayload = {
    id: number;
    role: string;
}


const generateAccessToken = (payload: JWTPayload, secretKey: string): string => {
    const token: string = jwt.sign(
        payload,
        secretKey,
        {
            expiresIn: '15m',
            issuer: "test-web-app",
            audience: "test-audience-web"
        }
    );
    return token
}; 


const generateRefreshToken = (payload: JWTPayload, secretKey: string): string =>{
    const token: string = jwt.sign(
        payload,
        secretKey,
        {
            expiresIn: '7d',
        }
    );
    return token
}


export { generateAccessToken,  generateRefreshToken}