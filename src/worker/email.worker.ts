import {Worker} from "bullmq";
import { sendEmail } from "../utils/sendEmail.js";
import { bullmqConnection } from "../config/bullMQ.radis.config.js";


const emailRegisterWorker = new Worker(
    "registerEmailQueue",
    async(job)=>{
        if(job.name === "register-user-email"){
            const {email, subject,  html } = job.data;
            console.log("sending the email");
            
            await sendEmail(email, subject, html);
            console.log("email send successfully");
            
        }
    }, 
    {
        connection: bullmqConnection
    }
)
console.log("Email worker is running");

export { emailRegisterWorker };