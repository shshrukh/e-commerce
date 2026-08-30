export type dataBaseConfig = {
    user: string;
    password: string;
    host: string;
    port: number;
    database: string;
    max: number;
    min: number;
    idleTimeoutMillis: number;
}

export type CloudinaryConfig = {
    cloud_name: string; 
    api_key: string;
    api_secret: string;
}


export type CloudinaryUploadOptions = {
    folder?: string;
    publicId?: string;
    transformation?: {
        width?: number;
        height?: number;
        crop?: string;
        gravity?: string;
    }[];
};

export type CloudinaryUploadResult = {
    publicId: string;
    secureUrl: string;
    format: string;
    bytes: number;
};