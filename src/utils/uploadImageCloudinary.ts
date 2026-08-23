import { cloudinary } from "../config/cloudinary.config.js";
import streamifier from "streamifier";
import type { CloudinaryUploadOptions, CloudinaryUploadResult } from "../types/types.js";
import { CloudinaryError } from "../Errors/CloudinaryError.js";

export const uploadImageToCloudinary = (
    imageBuffer: Buffer,
    options: CloudinaryUploadOptions = {},
): Promise<CloudinaryUploadResult> => {

    return new Promise((resolve, reject) => {

        const uploadOptions = {
            resource_type: "image" as const,

            ...(options.folder && {
                folder: options.folder,
            }),

            ...(options.publicId && {
                public_id: options.publicId,
            }),
        };

        const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {

                if (error) {
                    reject(
                        new CloudinaryError(
                            "Failed to upload image",
                            error
                        ),
                    );
                    return;
                }

                if (!result) {
                    reject(
                        new CloudinaryError(
                            "Image upload failed",
                            error
                        ),
                    );
                    return;
                }

                resolve({
                    publicId: result.public_id,
                    secureUrl: result.secure_url,
                    format: result.format,
                    bytes: result.bytes,
                });
            },
        );

        streamifier
            .createReadStream(imageBuffer)
            .pipe(uploadStream);
    });
};


export const deleteImageFromCloudinary = (
    publicId: string,
): Promise<void> => {

    return new Promise((resolve, reject) => {

        cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: "image",
            },
            (error, result) => {

                if (error) {
                    reject(error);
                    return;
                }

                if (result.result !== "ok" && result.result !== "not found") {
                    reject(
                        new Error(
                            `Cloudinary image deletion failed: ${result.result}`,
                        ),
                    );
                    return;
                }

                resolve();
            },
        );
    });
};