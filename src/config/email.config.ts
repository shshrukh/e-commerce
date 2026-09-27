import nodemailer from "nodemailer";
import "dotenv/config";

type SmptConfig = {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
};

const requiredEnv = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS"
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        throw new Error(`Missing env variable: ${key}`);
    }
}

const smtpPort = Number(process.env.SMTP_PORT);


const smtpConfig: SmptConfig = {
    host: process.env.SMTP_HOST!,
    port: smtpPort,
    secure: false,
    auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
    },
};

const transporter = nodemailer.createTransport(smtpConfig);

export { transporter };