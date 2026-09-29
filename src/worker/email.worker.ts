import {Worker} from "bullmq";
import { sendEmail } from "../utils/sendEmail.js";
import { bullmqConnection } from "../config/bullMQ.radis.config.js";


const emailRegisterWorker = new Worker(
    "registerEmailQueue",
    async(job)=>{
        if(job.name === "register-user-email"){
            try {
                const {email, subject,  html } = job.data;
                await sendEmail(email, subject, html);
            } catch (error) {
                throw error
            }
            
        }
    }, 
    {
        connection: bullmqConnection
    }
)

export { emailRegisterWorker };