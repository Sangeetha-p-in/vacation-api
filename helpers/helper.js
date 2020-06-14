const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const config = require('../helpers/constants');
const nodemailer = require('nodemailer');
const FCM = require('fcm-push');
let fcm = new FCM(config.fcm_key);


 let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: 'qanewagesmb@gmail.com', // generated ethereal user
            pass: 'Newagesm8' // generated ethereal password
        }
    });

   

const HelperFunc = function() {

}

HelperFunc.prototype.getUniqueId = function(size) {
    return new Promise(function(resolve, reject){
        crypto.randomBytes(size, function(err, buffer){
            if(err) reject(err.toString());
            else resolve(buffer.toString('hex'));
        })
    })
}
HelperFunc.prototype.encryptPassword = function(pass ='', algorithm='', secret ='') {
    if(algorithm && pass && secret){
        const cipher = crypto.createCipher(algorithm, secret);
        let encrypted = cipher.update(pass, 'utf8', 'hex');
        let passEncrypted = `${encrypted}${cipher.final('hex')}`;        
        return passEncrypted;
    } else return;
}
HelperFunc.prototype.decryptPassword = function(passEncrypted = '', algorithm = '', secret = ''){
    if(passEncrypted && algorithm && secret){
        let decipher = crypto.createDecipher(algorithm, secret);
        let dec = decipher.update(passEncrypted, 'hex', 'utf8');
        dec = `${dec}${decipher.final('utf8')}`;
        return dec;
    } else return;

}
HelperFunc.prototype.uploadBase64Image = function(image='', uploadBase = ''){  

    if(image != '' && uploadBase != '') {

        if(!fs.existsSync(uploadBase))
            fs.mkdirSync(uploadBase);

        let filepath = `${uploadBase}profile_images`;

        if(!fs.existsSync(filepath))
            fs.mkdirSync(filepath)

        let filename = `${Date.now()}.png`;

        filepath = `${filepath}/${filename}`;

        let base64 = image.split('base64,')[1];

        fs.writeFileSync(filepath, base64, 'base64');

        return filename;

    } else return;

}
HelperFunc.prototype.createToken = function(data = {}, secret = '', expiry = '') {
    if(data && secret && expiry) {
        let token = jwt.sign(data, secret, {
            expiresIn: expiry
        })
        return token;
    } else return;
}
HelperFunc.prototype.send_mail =function(to_mail_id, subject,emailTemplate) {
     // setup email data with unicode symbols
        let mailOptions = {
            from: config.fromName +'<'+ config.fromMail+'>', // sender address
            to: to_mail_id, // list of receivers
            subject: subject, // Subject line
           // text: 'Hello world?', // plain text body
            html: config.mailHeader+emailTemplate+config.mailFooter // html body
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            // Preview only available when sending through an Ethereal account
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

            // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
            // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
        });


    },

HelperFunc.prototype.middleware = function(req, res, next) {


    let token = req.headers['x-access-token'] || '';
    //console.log("authtoken=",token);

    let method = req.method;

    token = token.replace(/^Bearer\s/, '');
    console.log('token: ' + token);
    let verify_response = jwt.verify(token, config.jwtSecret, function(err, decoded) {
        console.log(err);
        console.log("decoded==",decoded);
			if (!err) {
				req.decoded = decoded;
				res.setHeader('Authentication',true);
				next();

			} else if (err.name == 'TokenExpiredError') {				
					res.setHeader('Authentication',false);
					return res.json({ status: false, message: 'Your current session is expired. Please login to continue.', 'statusCode': 'TokenExpired' });
			} else {
				res.setHeader('Authentication',false);
				return res.json({ status: false, message: 'Failed to authenticate token.', 'statusCode': "TokenInvalid" });
			}
    });

    if (method != 'OPTIONS') {
        if (token) {
            jwt.verify(token, config.jwtSecret, verify_response);

        } else {
            res.setHeader('Authentication',false);
            return res.json({
                status: false,
                message: 'No token provided.',
                statusCode: "TokenMissing"
            });
        }
    } else {
        return res.json({ status: true, "message": "Server preflight verification success." });
    }


    /* console.log(x);
    if (x != true) {
        res.json({ auth: false });
    } else {
        res.json({ auth: true });
    } */
},

HelperFunc.prototype.send_push =function(device_token,notification_data) {
    let notification_datas=notification_data;
    notification_datas.sound="default";
    notification_datas.badge="1";
    let data_info=notification_data;
    data_info.channelId="HM001235";
    
    
    var message = {
        to: device_token, // required fill with device token or topics
        collapse_key: 'newage', 
       /*  data: {
            your_custom_data_key: 'your_custom_data_value'
        },
        notification: {
            title: 'Title of your push notification',
            body: 'Body of your push notification'
        } */
    
        data: notification_data,
        notification: notification_datas

        
    };

        //promise style
    fcm.send(message)
    .then(function(response){
        console.log("Successfully sent with response: ", response);
    })
    .catch(function(err){
        console.log("Something has gone wrong!");
        console.error(err);
    })


   },

module.exports = HelperFunc;