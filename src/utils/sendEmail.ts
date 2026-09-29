
import { transporter } from "../config/email.config.js";

const sendEmail = async (
    userEmail: string,
    subject: string,
    html: string
) => {
    try {
        const senderEmail = process.env.SMTP_USER as string;
        if (!senderEmail) {
            throw new Error("Missing env variable: SMTP_EMAIL or SMTP_USER");
        }

        const info = await transporter.sendMail({
            from: senderEmail,
            to: userEmail,
            subject: subject,
            html: html
        });

        
        // console.log(info);
        
    } catch (error) {
        console.error("Error while sending mail:", error);
    }
};

export { sendEmail };
