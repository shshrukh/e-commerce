import { AppError } from "./AppError.js";


class InternalServerError extends AppError {
    constructor( message = "Internal Server Error"){
        super( message, 500 )
    }
};


export { InternalServerError };