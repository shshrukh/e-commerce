import { confirmRegistration } from "../emails/registerationEmail.js";
import { sendEmail } from "../utils/sendEmail.js";
import { myEmitter } from "./eventEmitter.js";
type EmailSndPayload = {
    email: string;
    first_name : string
}

myEmitter.on("register-user", async (payload: EmailSndPayload)=>{

    await sendEmail(payload.email, "WELCOME TO AURA-NUTS", confirmRegistration(payload.first_name, payload.email, 12345) );
    
    console.log(`email is snd successfully ${payload.email}`);
    
})

