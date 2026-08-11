import { AppError } from "./AppError.js";


class BedRequestError extends AppError {
    constructor(message = "Bed Request"){
        super(message, 400)
    }
};


export { BedRequestError };

