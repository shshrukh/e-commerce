import multer, {
    type FileFilterCallback,
    type Options,
} from "multer";
import { ValidationError } from "../Errors/ValidationError.js";

const createImageUploadMiddleware = (
    maxFileSizeInMB: number,
    allowedMimeTypes: string[],
): multer.Multer => {

    const memoryStorage = multer.memoryStorage();

    const uploadLimits: Options["limits"] = {
        fileSize: maxFileSizeInMB * 1024 * 1024,
        files: 1,
        fields: 10,
        parts: 11,
    };

    const imageFileFilter = (
        request: Express.Request,
        file: Express.Multer.File,
        callback: FileFilterCallback,
    ): void => {

        const isAllowedMimeType =
            allowedMimeTypes.includes(file.mimetype);

        if (!isAllowedMimeType) {
            callback(new ValidationError("Invalid image file type"));
            return;
        }

        callback(null, true);
    };

    return multer({
        storage: memoryStorage,
        limits: uploadLimits,
        fileFilter: imageFileFilter,
    });
};

const uploadProductImage = createImageUploadMiddleware(
    1,
    [
        "image/jpeg",
        "image/png",
        "image/webp",
    ],
);

export { uploadProductImage };