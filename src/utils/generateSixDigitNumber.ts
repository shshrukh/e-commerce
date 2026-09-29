
const sixDigitRendomNumber = function():string{
    const numbers = ["1","2","3","4","5","6","7","8","9","0"];
    let number = "" ;
    for (let index = 0; index < 6; index++) {
        const rendomNumber = Math.floor(Math.random() * numbers.length );
        number+= numbers[rendomNumber];    
    }
    return number
}

export {sixDigitRendomNumber}