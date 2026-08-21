import { v2 as cloudinary } from "cloudinary";
import type { CloudinaryConfig } from "../types/types.js";



const cloudinaryConfigOptions: CloudinaryConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!
}

for(const [key, value] of Object.entries(cloudinaryConfigOptions)){
    if(!value){
        throw new Error(`Missing Cloudinary environment variable: ${key}`);
    }
}
cloudinary.config({
    ...cloudinaryConfigOptions,
    secure: true
});


export {cloudinary};






