function confirmRegistration(username: string, useremail: string, code: string) {
return ` <div style="
     font-family: Arial, sans-serif; 
     max-width: 600px; 
     margin: auto; 
     padding: 20px; 
     border: 1px solid #e0e0e0; 
     border-radius: 10px;
     background-color: #f9f9f9;
     color: #333;
 "> <h2 style="color: #F59115;">
Welcome to Aura Nuts, ${username}! 🥜 </h2>

    <p>Thank you for creating an account with Aura Nuts.</p>

    <p>Your registered email is: <b>${useremail}</b></p>

    <p>
        Please use the verification code below to verify your email address:
    </p>

    <div style="
        margin: 25px 0;
        padding: 15px;
        text-align: center;
        background-color: #fff3e0;
        border-radius: 8px;
        font-size: 32px;
        font-weight: bold;
        letter-spacing: 8px;
        color: #F59115;
    ">
        ${code}
    </div>

    <p>
        This verification code will expire in 5 minutes.
    </p>

    <p style="font-size: 13px; color: #888;">
        If you did not create an Aura Nuts account, you can safely ignore this email.
    </p>

    <p style="margin-top: 30px; font-size: 12px; color: #888;">
        © ${new Date().getFullYear()} Aura Nuts. All rights reserved.
    </p>
</div>
`;

}

export { confirmRegistration };
