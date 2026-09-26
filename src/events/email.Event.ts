import { myEmitter } from "./eventEmitter.js";
type EmailSndPayload = {
    email: string;
}

myEmitter.on("register-user", (payload: EmailSndPayload)=>{
    console.log(`email is snd successfully ${payload.email}`);
    
})

