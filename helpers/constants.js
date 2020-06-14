const appConfig = {

    error: {
        networkError: "Unable to connect!Please check your network connection.",        
        typeError: "Invalid user type!",
        errFirstName: "First name is required.",
        errLastName: "Last name is required.",
        errZipCode: "Zip Code is required.",
        errCity: "City is required.",
        errMydream: "My Dream is required.",
        errStateID: "State Id is required.",
        errPhoneNo: "Phone number is required.",
        errEmail: "Email is required.",
        invalidEmail: "Invalid email.",
        errPassword: "Password is required.",        
        errToken:"Token is required.",
        userNotExitError:"User does not exist.",
        errSMtoken:"Social media token is required.",
        userExists:"User already exist.",
        passIncorrect:"Password Incorrect",
        errUserActive:"User not active",
        approveError:"Witing for admin approvel",
        recetCodeError:"Reset Code required.",
        verifyResetCodeError:"Enter valid reset code.",
        errTitle:"Title is required.",
        errCatId:"Category Id is required.",
        errDesc:"Description is required.",
        errLocation:"Location is required.",
        errType:"Type is required.",
        errcomment:"Comment is Required",
        errVideoId:"Video source not found",
        errName:"Name is required.",
        errAmount:"Amount is required.",
        errCardToken:"No card details found.",
        errOldPass:"Old Password is required.",
        errNewPass:"New Password is required.",
        errConfirmPass:"Confirm Password is required.",
        passMissmatch:"Password Missmatch.",
        oldPassIncorrect:"Incorrect old Password.",
        errcommentId:"Comment Id is required.",
        errreaction:"Reaction is Required",
    },

    secret: "newage2win",

    encryptAlgorithm: 'aes-256-cbc',

    algorithmSecret: 'newagesmb',

    jwtSecret: 'vacationme1234',

    tokenExpiry: '30d',

    uploadPath: 'public/uploads/',

   // proPicPath: 'http://10.10.10.85:5880/uploads/profile_images/',

    //stripe_secret:'sk_test_6J3BrJu9xbWPbHbdsqIABHex',

    stripe_secret:'sk_test_fRktwhBSRchgPhwKBYSlRcVb',

    proPicPath: 'https://newagesme.com:7011/uploads/profile_images/',

    limit:15,

    
    success: {
        signupMsg: "Your account has been successfully registered.",
        signinMsg: "You have successfully sigin in.",
        changePasswordMsg: "Password successfully updated.",
        editUserNameMsg: "User name successfully updated.",
        delAccMsg:"Account successfully deleted.",
        editProfileMsg:"Profile successfully updated.",
        forgotPassMsg:"We have sent a verification code to your email address.",
        verifyResetCodeMsg:"Reset code verified.",
        resetPasswordMsg:"New Password successfully updated.", 
        verifyEmailMsg:"Email successfully verified." ,        
        profileMsg: "User Profile.",    
    },

    fromName:'Pharmaapp',
    fromMail:'qanewagesmb@gmail.com',
    mailHeader: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Vacation Me</title>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        </head>
        <body>
         <div style="background:#ffd202; padding: 2%;">
         <div style="width:900px;margin:5% auto;background:#fff;padding:30px;border-radius:6px; text-align:center;">
                  <img style="margin:40px auto 0px auto;display: -webkit-box;width: 200px; text-align:center;" src="https://www.vacationme.com/admin/assets/images/logo-login.png">
`,
    mailFooter:`<br>
         <p style="font-size:24px;color:#de0c3e;padding-top:50px;">Thanks,
        <br>
        Vacation Me Team</p>
        </div>
        </div>
        </body></html>`,
    /* For FCM push */
    fcm_key: 'AIzaSyDygcwWseaONAbB_duNezVYaypx-uiEXbo',   
}

module.exports = appConfig;