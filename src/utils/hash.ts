import crypto from "crypto";

const hashSecret= (value: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");

        crypto.pbkdf2(
            value,
            salt,
            100_000,
            64,
            "sha512",
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(`${salt}:${derivedKey.toString("hex")}`);
            }
        );
    });
};

const verifySecret = (
    value: string,
    hashValue: string
): Promise<boolean> => {
    return new Promise((resolve, reject) => {
       
        const [salt, storedHash] = hashValue.split(":");
        
        if(!salt || !storedHash ){
            reject(false);
            return
        }
        crypto.pbkdf2(
            value,
            salt,
            100_000,
            64,
            "sha512",
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                const hash = derivedKey.toString("hex");

                resolve(hash === storedHash);
            }
        );
    });
};


export { hashSecret, verifySecret }