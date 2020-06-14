const express = require('express');
const config = require('../helpers/constants');
const HelperFunc = require('../helpers/helper');
const model = require('../models/index');
const helperFunc = new HelperFunc();
const sequelize = require("sequelize");
const uniqid = require("uniqid");
const Common = require('../helpers/common');
let jwt = require("jsonwebtoken");
let randToken = require("rand-token");
let functions = require("../helpers/functions");
let client = require("../dao/clientDao");
const async = require("async");
const moment = require('moment');
const posthandler = require("../handlers/postsHandler");
let stripe;



let handler = {
  index(req, res, next) {
    res.send("respond with a resource");
  },
  login(req, res, next) {
    req.checkBody('email', config.error.errEmail).notEmpty();

    if (req.body.email) req.checkBody('email', config.error.invalidEmail).isEmail();

    req.checkBody('password', config.error.errPassword).notEmpty();

    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      model.User.findOne({
        where: {
          email: {
            [Op.eq]: req.body.email
          }
        }
      }).then(userInfo => {
        console.log("Userinfo: ", userInfo, userInfo.id);
        if (userInfo) {
          // console.log("userInfo===",userInfo);
          let user = JSON.parse(JSON.stringify(userInfo));

          let password = helperFunc.decryptPassword(user.password, config.encryptAlgorithm, config.algorithmSecret);
         
          let enter_password =  req.body.password.trim();
          if (password != enter_password) res.status(403).json({
            status: false,
            error: config.error.passIncorrect
          })
          else if (user.active == 'N') res.status(403).json({
            status: false,
            error: config.error.errUserActive
          })

          else if (user.admin_approved == 'N') res.status(403).json({
            status: false,
            error: config.error.approveError
          })

          else {
           
            //user.image = config.proPicPath + user.image;
            if (user.image != null && user.image != '') {
              user.image =user.image;
            } else {
              user.image = config.proPicPath + 'default.png';
            }

              let user_data={
              email_verified:user.email_verified,
              image:user.image,
              first_name:user.first_name,
              last_name:user.last_name,
              user_id: user.id
            };

            req.userID = user.id;
            posthandler.save_device_token(req,res,next);


            /*let authToken = helperFunc.createToken(user, config.jwtSecret, config.tokenExpiry);
            res.setHeader('x-access-token', authToken);*/

            let userData = user;
            /* let access_token = helperFunc.createToken(userData, config.jwtSecret, config.tokenExpiry);
            let refresh_token = Common.randomToken(255);
              let headers = {
                  'x-access-token': access_token,
                  'x-refresh-token': refresh_token
                };
            res.setHeader('x-access-token', access_token);
            res.setHeader('x-refresh-token', refresh_token); */

          let userDetails = user;
          userDetails.user_id = user.id;
          console.log("password above: ", password);
          let token = jwt.sign(userDetails, config.secret, {
            expiresIn: 3600000000
          });
          console.log("token: ", token);

          // let refreshToken = randToken.uid(256);
          let refreshToken = '1234567890';
          console.log("refreshToken: ", refreshToken);
          functions.createRefreshTokenJsonFile(userDetails, refreshToken);

          res.setHeader("RefreshToken", refreshToken);

          res.setHeader("AuthToken", token);

          res.setHeader("Authentication", true);
          


            res.status(200).json({
              status: true,
              message: config.success.signinMsg,
              // headers:headers,
              data:user_data,
            });
            userInfo.update({
              platform: req.body.platform,
              device_token: req.body.device_token
            });
          }
        } else res.status(403).json({
          status: false,
          data:{},
          error: config.error.userNotExitError
        });

      })
      .catch(err => res.status(403).json({
        status: false,
        // data:{},
        error: err.toString()
      }));
    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  },

  socialmedia_login(req, res, next) {
    console.log("socialmedia_login Body: ", req.body);
    req.checkBody('social_media_token', config.error.errToken).notEmpty();
    let err = req.validationErrors();
    console.log("err Body: ", err);
    if (err == false) {
      console.log('Status', err);
      const Op = model.Sequelize.Op;

      model.User.findOne({
        where: {
          [Op.or]: [{facebook_token: req.body.social_media_token}, {google_token: req.body.social_media_token}]
        }
      })
        .then(userInfo => {
          if (userInfo) {
             console.log("userInfo===",userInfo);
            let user = JSON.parse(JSON.stringify(userInfo));
           
             if (user.image != null && user.image != '') {
                user.image =  user.image;
              } else {
                user.image = config.proPicPath + 'default.png';
              }
            if (user.active == 'N') res.status(403).json({
              status: false,
              error: config.error.errUserActive
            });
            else if (user.admin_approved == 'N') res.status(403).json({
              status: false,
              error: config.error.approveError
            });

            else {
              let user_data={
                email_verified:user.email_verified,
                image:user.image,
                first_name:user.first_name,
                last_name:user.last_name,
                user_id: user.id
              };
            let userDetails =user;             

            let token = jwt.sign(userDetails, config.secret, {
              expiresIn: 3600000000
            });

            let refreshToken = randToken.uid(256);

            functions.createRefreshTokenJsonFile(userDetails, refreshToken);

            res.setHeader("RefreshToken", refreshToken);

            res.setHeader("AuthToken", token);

            res.setHeader("Authentication", true);
              res.status(200).json({
                status: true,
                message: config.success.signinMsg,
                data:user_data,
                // unique_name: user.UserType.unique_name
              });
              userInfo.update({
                platform: req.body.platform,
                device_token: req.body.device_token
              });
            }
          } else res.status(403).json({
            status: false,
            data:{},
            error: config.error.userNotExitError
          });

        })
        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));
    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  },
  socialmedia_register(req, res, next) {

    req.checkBody('first_name', config.error.errFirstName).notEmpty();
    req.checkBody('last_name', config.error.errLastName).notEmpty(); 
    if(req.body.facebook_token){
      req.checkBody('facebook_token', config.error.errEmail).notEmpty();
    } else{
      req.checkBody('google_token', config.error.errPassword).notEmpty();
    }     
    
      
    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      model.User.findOne({
        where: {
          $or: [
                  {
                      facebook_token: 
                      {
                          $eq: req.body.facebook_token
                      }
                  }, 
                  {
                      google_token: 
                      {
                          $eq: req.body.google_token
                      }
                  }
              ]
        }
      }).then((user) => {

        if (user != '' && user != undefined && user.id > 0) throw (new Error(config.error.userExists));
        else {

         // let unique_id=helperFunc.getUniqueId(16);
          //console.log("unique_id",unique_id);
          //let reset_code = Math.floor(Math.random() * (9999 - 1000) + 1000);
          let userData = {
            unique_id: uniqid(),
            first_name: req.body.first_name,
            last_name: (req.body.last_name) ? req.body.last_name : '',
            //email: req.body.email,
           // password: helperFunc.encryptPassword(req.body.password, config.encryptAlgorithm, config.algorithmSecret),
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            device: req.body.device,
            email_verified: 'Y',
            //reset_code:reset_code,
            //facebook_token: req.body.facebook_token,
            //google_token: req.body.google_token,
          }
          if(req.body.facebook_token){
            userData.facebook_token=req.body.facebook_token;
          }else{
            userData.google_token=req.body.google_token;          
          }
          return model.User.create(userData);
        }

      })
        .then((inserted) => {
          let user_id = inserted.id;
          return model.User.findOne({
            where: {
              id: {
                [Op.eq]: user_id
              }
            }
          });

        })
        .then(createdUser => {
          let userInfo = JSON.parse(JSON.stringify(createdUser));
           let userDetails =userInfo;             

            let token = jwt.sign(userDetails, config.secret, {
              expiresIn: 3600000000
            });

            let refreshToken = randToken.uid(256);

            functions.createRefreshTokenJsonFile(userDetails, refreshToken);

            res.setHeader("RefreshToken", refreshToken);

            res.setHeader("AuthToken", token);

            res.setHeader("Authentication", true);
          delete userInfo.password;
          res.status(200).json({
            status: true,
            message: config.success.signupMsg,
            data:userInfo,
          });

          let email_content = `
                            <div><h1 style="font-family: sans-serif;font-size:40px;text-align:center;color:#4badd3;padding-bottom:50px;margin:0px;">Registration Success</h1></div>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Hi ${userInfo.first_name} ${userInfo.last_name},</p>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Your account has been created successfully.</p>`;

          let subject = 'Registration Success';
          let send_mail = helperFunc.send_mail(userInfo.email, subject, email_content);

        })
        .catch((err) => {
          res.status(403).json({
            status: false,
            error: err.toString()
          });
        });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  },


  register(req, res, next) {
    let reset_code="";
    req.checkBody('first_name', config.error.errFirstName).notEmpty();
    req.checkBody('last_name', config.error.errLastName).notEmpty();
   
      req.checkBody('email', config.error.errEmail).notEmpty();
      req.checkBody('password', config.error.errPassword).notEmpty();
    
    
    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      model.User.findOne({
        where: {
          email: {
            [Op.eq]: req.body.email
          }
        }
      }).then((user) => {

        if (user != '' && user != undefined && user.id > 0) throw (new Error(config.error.userExists));
        else {
          reset_code = Math.floor(Math.random() * (9999 - 1000) + 1000);
          let userData = {
            unique_id: uniqid(),
            first_name: req.body.first_name,
            last_name: (req.body.last_name) ? req.body.last_name : '',
            email: req.body.email,
            password: helperFunc.encryptPassword(req.body.password, config.encryptAlgorithm, config.algorithmSecret),
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            device: req.body.device,
            reset_code: reset_code,
          }
           console.log("userData",userData);

          return model.User.create(userData);
        }

      })
        .then((inserted) => {
          let user_id = inserted.id;
          req.userID = user_id;
          posthandler.save_device_token(req,res,next);
          return model.User.findOne({
            where: {
              id: {
                [Op.eq]: user_id
              }
            }
          });

        })
        .then(createdUser => {
          let userInfo = JSON.parse(JSON.stringify(createdUser));
            let userDetails =userInfo;             

            let token = jwt.sign(userDetails, config.secret, {
              expiresIn: 3600000000
            });

            let refreshToken = randToken.uid(256);

            functions.createRefreshTokenJsonFile(userDetails, refreshToken);

            res.setHeader("RefreshToken", refreshToken);

            res.setHeader("AuthToken", token);

            res.setHeader("Authentication", true);
          delete userInfo.password;
          userInfo.id = req.userID;
          res.status(200).json({
            status: true,
            message: config.success.signupMsg,
            data:userInfo,
          });

          let email_content = `<div><h1 style="font-family: sans-serif;font-size:40px;text-align:center;color:#4badd3;padding-bottom:50px;margin:0px;">Registration Success</h1></div>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Hi ${userInfo.first_name} ${userInfo.last_name},</p>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Your account has been created successfully and is currently under admin review. We will let you know once the review process is completed.</p>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Your verification code is ${reset_code}</p>`;

          let subject = 'Registration Success';
          let send_mail = helperFunc.send_mail(userInfo.email, subject, email_content);

        })
        .catch((err) => {
          res.status(403).json({
            status: false,
            error: err.toString()
          });
        });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  },
  forgot_password(req, res, next) {
    req.checkBody('email', config.error.errEmail).notEmpty();

    if (req.body.email) req.checkBody('email', config.error.invalidEmail).isEmail();
  
    let err = req.validationErrors();
  
    if (err == false) {
  
      const Op = model.Sequelize.Op;
  
      model.User.findOne({
          where: {
            email: {
              [Op.eq]: req.body.email
            }
          }
        })
        .then(userInfo => {
          if (userInfo) {
            let user = JSON.parse(JSON.stringify(userInfo));
  
            let reset_code = Math.floor(1000 + Math.random() * 9000);
            userInfo.update({
              reset_code: reset_code
            });
  
            let email_content = `<div><h1 style="font-family: sans-serif;font-size:40px;text-align:center;color:#4badd3;padding-bottom:50px;margin:0px;">Forgot Password</h1></div>
                              <p style="font-family: sans-serif;font-size:18px;color:#333;">Hi ${user.first_name} ${user.last_name},</p>
                              <p style="font-family: sans-serif;font-size:18px;color:#333;">Please enter the reset code below to change your account Password.</p>
                              <p style="font-family: sans-serif;font-size:18px;color:#333;">Reset Code: ${reset_code},</p>`;
  
            let subject = 'Forgot Password';
            let send_mail = helperFunc.send_mail(user.email, subject, email_content);
            res.status(200).json({
              status: true,
              message: config.success.forgotPassMsg,
              function: "forgot_password",
              reset_code: reset_code
            });
  
          } else res.status(403).json({
            status: false,
            error: config.error.userNotExitError,
            function: "forgot_password"
          });
  
        })
        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));
    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : ''),
      function: "forgot_password"
    });  

  },


  verify_resetcode(req, res, next){

    req.checkBody('email', config.error.errEmail).notEmpty();
  
    req.checkBody('reset_code', config.error.recetCodeError).notEmpty();
  
    if (req.body.email) req.checkBody('email', config.error.invalidEmail).isEmail();
  
    let err = req.validationErrors();
  
    if (err == false) {
  
      const Op = model.Sequelize.Op;
  
      model.User.findOne({
          where: {
            email: {
              [Op.eq]: req.body.email
            },
            reset_code: {
              [Op.eq]: req.body.reset_code
            }
          }
        })
        .then(userInfo => {
          if (userInfo) {
  
            res.status(200).json({
              status: true,
              message: config.success.verifyResetCodeMsg,
              function: "verify_resetcode"
            });
  
          } else res.status(403).json({
            status: false,
            error: config.error.verifyResetCodeError,
            function: "verify_resetcode"
          });
  
        })
        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));
    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : ''),
      function: "verify_resetcode"
    });
  },
  reset_password(req, res, next){
  req.checkBody('email', config.error.errEmail).notEmpty();

  req.checkBody('reset_code', config.error.recetCodeError).notEmpty();

  req.checkBody('new_password', config.error.errNewPass).notEmpty();

  req.checkBody('confirm_password', config.error.errConfirmPass).notEmpty();

  if (req.body.new_password != req.body.confirm_password) res.status(403).json({
    status: false,
    error: config.error.passMissmatch
  });


  if (req.body.email) req.checkBody('email', config.error.invalidEmail).isEmail();



  let err = req.validationErrors();

  if (err == false) {

    const Op = model.Sequelize.Op;

    model.User.findOne({
        where: {
          email: {
            [Op.eq]: req.body.email
          },
          reset_code: {
            [Op.eq]: req.body.reset_code
          }
        }
      })
      .then(userInfo => {
        if (userInfo) {

          return userInfo.update({
            reset_code: null,
            password: helperFunc.encryptPassword(req.body.new_password, config.encryptAlgorithm, config.algorithmSecret)
          });


          //  res.json({ status: true, message: config.success.verifyResetCodeMsg ,function:"verify_resetcode"});

        } else throw config.error.verifyResetCodeError;

        //res.status(403).json({ status: false, error: config.error.verifyResetCodeError, function: "reset_password" });

      })

      .then(function (record) {
        res.status(200).json({
          status: true,
          data: {},
          message: config.success.resetPasswordMsg,
          function: "reset_password"
        });
      })

      .catch(err => res.status(403).json({
        status: false,
        error: err.toString()
      }));
  } else res.status(403).json({
    status: false,
    error: (err.hasOwnProperty('length') ? err[0].msg : ''),
    function: "reset_password"
  });
  },


    verify_email(req, res, next){

    //req.checkBody('email', config.error.errEmail).notEmpty();
  
    req.checkBody('verification_code', config.error.recetCodeError).notEmpty();
  
    //if (req.body.email) req.checkBody('email', config.error.invalidEmail).isEmail();
  
    let err = req.validationErrors();
  
    if (err == false) {
  
      const Op = model.Sequelize.Op;
  
      model.User.findOne({
          where: {
            /*email: {
              [Op.eq]: req.body.email
            },*/
            reset_code: {
              [Op.eq]: req.body.verification_code
            }
          }
        })
        .then(userInfo => {
          if (userInfo) {
  
            res.status(200).json({
              status: true,
              message: config.success.verifyEmailMsg,
              function: "verify_email"
            });

            userInfo.update({
              reset_code: null,
              email_verified: 'Y'
            });
  
          } else res.status(403).json({
            status: false,
            error: config.error.verifyResetCodeError,
            function: "verify_email"
          });
  
        })
        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));
    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : ''),
      function: "verify_resetcode"
    });
  },


  profile_details(req, res, next)  {
  let user = {};
  if (req.decoded.id) {
    const Op = model.Sequelize.Op;
    model.User.findOne({
        attributes: ['id','first_name', 'last_name', 'email', 'image','zip_code','my_dream','city'],
       include: [{
            model: model.States,
            attributes: ['id', 'state_name', 'state_code'],
            required: false
          }],
        where: {
          id: {
            [Op.eq]: req.decoded.id
          }
        },
        //  raw: true,
      })
      .then(userInfo => {

        user = JSON.parse(JSON.stringify(userInfo));

         if (user.image != null && user.image != '') {
            user.image = user.image;
          } else {
            user.image = config.proPicPath + 'default.png';
          }
        res.status(200).json({
          status: true,
          data: user,
          message: config.success.profileMsg
        });
        
      })  

      .catch(err => res.status(403).json({
        status: false,
        error: err.toString()
      }));

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError"
  })
},

states_list(req, res, next)  {
  if (req.decoded.id) {
    const Op = model.Sequelize.Op;
    model.States.findAll({
        attributes: ['id', 'state_name'],     
      })
      .then(states => {

        res.status(200).json({
          status: true,
          data: states,
          message: ""
        });
        
      })  

      .catch(err => res.status(403).json({
        status: false,
        error: err.toString()
      }));

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError"
  })
},

edit_profile(req, res, next) {
  console.log(req.body);

  if (req.decoded.id) {

    req.checkBody('first_name', config.error.errFirstName).notEmpty();

    req.checkBody('last_name', config.error.errLastName).notEmpty();

    //req.checkBody('email', config.error.errPharmacyName).notEmpty();

    req.checkBody('zip_code', config.error.errZipCode).notEmpty();

    req.checkBody('city', config.error.errCity).notEmpty();

    req.checkBody('my_dream', config.error.errMydream).notEmpty();

    req.checkBody('state_id', config.error.errStateID).notEmpty();

    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      model.User.update({
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          //email: req.body.email,
          my_dream: req.body.my_dream,
          city: req.body.city,
          state_id: req.body.state_id,
          zip_code: req.body.zip_code,
        }, {
          where: {
            id: req.decoded.id
          }
        })

        .then(rowsUpdated => {

          if (req.body.image) {
            let imgregex = /^\s*data:([a-z]+\/[a-z]+(;[a-z\-]+\=[a-z\-]+)?)?(;base64)?,[a-z0-9\!\$\&\'\,\(\)\*\+\,\;\=\-\.\_\~\:\@\/\?\%\s]*\s*$/i;
            console.log("img", req.body.image);
            if (req.body.image.match(imgregex)) {
              return helperFunc.uploadBase64Image(req.body.image, config.uploadPath);
            } else {
              return 1;
            }


          } else {
            return 1;
          }

        })

        .then((userupdate) => {
          let Op = model.Sequelize.Op;
          if (userupdate != 1) {
            return model.User.update({
              image: config.proPicPath+userupdate
            }, {
              where: {
                id: {
                  [Op.eq]: req.decoded.id
                }
              }
            });
          } else {
            return 1;
          }
        })

        .then(function (record) {
          // console.log("record", record);
          return model.User.findOne({
            attributes: ['first_name', 'last_name', 'email', 'image', 'zip_code', 'my_dream', 'city'],
            include: [{
              model: model.States,
              attributes: ['id', 'state_name', 'state_code'],
              required: false
            }],
            where: {
              id: {
                [Op.eq]: req.decoded.id
              }
            },
            //  raw: true,
          })
        })

        .then(userInfo => {
         // userInfo.image = config.proPicPath + userInfo.image;
          if (userInfo.image != null && userInfo.image != '') {
            userInfo.image = userInfo.image;
          } else {
            userInfo.image = config.proPicPath + 'default.png';
          }
          res.status(200).json({
            status: true,
            data: userInfo,
            message: config.success.editProfileMsg,
            function: "edit_profile"
          });
        })


        .catch((err) => {
          res.status(403).json({
            status: false,
            error: err.toString()
          });
        });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });
  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError"
  })
},

upload_video(req, res, next) {
  console.log(req.body,'body');
  if (req.decoded.id) {


    req.checkBody('title', config.error.errTitle).notEmpty();

    //req.checkBody('category_id', config.error.errCatId).notEmpty();

    //req.checkBody('description', config.error.errDesc).notEmpty();

    req.checkBody('type', config.error.errType).notEmpty();
    //req.checkBody('video_url', config.error.errVideoUrl).notEmpty();

    //req.checkBody('video_thumb', config.error.errVideoThumb).notEmpty();

    //req.checkBody('location', config.error.errLocation).notEmpty();
    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      req.body.category_id=1;
      if(req.body.type=='video'){
        console.log("is video");
        let addVideoData = {
                title: req.body.title,
                description:req.body.description,
                category_id: req.body.category_id,
                user_id: req.decoded.id,
                video_url:req.body.video_url, 
                video_thumb:req.body.video_thumb,
                location:req.body.location,
              };
        if(req.body.group_id != undefined && req.body.group_id > 0) {
          addVideoData.group_id = req.body.group_id;
        }
              model.Videos.create(addVideoData)
                .then((add_video) => {
                  if (add_video != '' && add_video != undefined && add_video.id > 0) {
                    //additional_product_id=additional_product.id;
                    let response = { status: true, message: 'Video uploaded successfully', data: {}, function: 'upload_video' };
                    res.json(response); 
                  }else
                  console.log(err);
                })
                .catch((err) => {
                  console.log(err);
                });
      }else{

        console.log("is image");
        let images=req.body.images;
        if(images.length > 0){


        
        let addAlbumData = {
            album_name: req.body.title,                
            user_id: req.decoded.id,               
          };
          model.Album.create(addAlbumData)
          .then((add_album) => {
              if (add_album != '' && add_album != undefined && add_album.id > 0) {
                album_id=add_album.id;
               
                images.forEach(function (image_url) {
                  if(req.body.group_id != undefined && req.body.group_id > 0) {
                    var addImageData = {
                      title: req.body.title,
                      description:req.body.description,
                      category_id: req.body.category_id,
                      user_id: req.decoded.id,
                      album_id:album_id,
                      photo_url:image_url, 
                      location:req.body.location,
                      group_id: req.body.group_id
                    };
                  }else{
                    var addImageData = {
                      title: req.body.title,
                      description:req.body.description,
                      category_id: req.body.category_id,
                      user_id: req.decoded.id,
                      album_id:album_id,
                      photo_url:image_url, 
                      location:req.body.location
                    };
                  }                
                    model.Photos.create(addImageData)
                });
                let response = { status: true, message: 'Images uploaded successfully', data: {}, function: 'upload_video' };
                res.json(response); 
              }else
              console.log(err);
            })
            .catch((err) => {
              console.log(err);
            });
          }else{
            let response = { status: false, message: 'Please select images', data: {}, function: 'upload_video' };
                res.json(response); 
          }
      }     
       

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : ''),
      function: 'upload_video' 
    });

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    function: 'upload_video' 
  })
},

/*video_list(req, res, next)  {
  if (req.decoded.id) {
    const Op = model.Sequelize.Op;
    model.Videos.findAll({
        attributes: ['id', 'title','description','video_thumb','video_url','location','total_views'],
        include: [{
              model: model.User,
              attributes: ['first_name', 'last_name','image'],
              required: false
            }],
        where: {
              user_id: {
                [Op.eq]: req.decoded.id
              }
            },     
      })
      .then(states => {

        res.status(200).json({
          status: true,
          data: states,
          message: "",
          function:"video_list"
        });
        
      })  

      .catch(err => res.status(403).json({
        status: false,
        error: err.toString(),
        function:"video_list"
      }));

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"video_list"
  })
},*/


video_list(req, res, next)  {
  if (req.decoded.id) {
     const Op = model.Sequelize.Op;
     client.getUserImgesVideos(req.decoded.id,req.body.page,config.limit)
          .then(result => {

              async.forEach(result,function(row,callback) {
                    row.User={first_name:row.first_name,last_name:row.last_name,image:row.image};
                    if(row.type=='video'){
                        row.video_thumb=row.thumb;
                        row.video_url=row.url;
                        delete (row.thumb);
                        delete (row.url);
                        callback();

                    }else{
                      row.album_name=row.title;
                      delete (row.thumb);
                      delete (row.url);
                      delete (row.title);
                      model.Photos.findAll({
                        //attributes: ['id', 'album_name'],
                        
                        where: {
                              album_id: {
                                [Op.eq]: row.id
                              }
                            }, 
                            
                      })
                      .then(photos => {
                        console.log("photos==",photos)
                        row.photos=photos;
                        callback();

                      })
                      .catch(err =>{
                         callback();
                      });
                    }
                    delete (row.first_name);
                    delete (row.last_name);
                    delete (row.image);

                    
               },function done() {
                     res.status(200).json({
                        status: true,
                        data: result,
                        message: "",
                        function:"video_image_list"
                      });
                });

            
          })
         .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"video_image_list"
          }));

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"video_list"
  })
},


video_details(req, res, next)  {
if (req.decoded.id) {
  const Op = model.Sequelize.Op;
  let video_info={};

   model.Videos.findOne({
        attributes: ['id', 'title','description','video_thumb','video_url','location','total_views'],
        include: [{
              model: model.User,
              attributes: ['first_name', 'last_name','image'],
              required: false
            }],
        where: {
              id: {
                [Op.eq]: req.body.video_id
              }
            },     
      })
 
    .then(video_data => {
      video_info=video_data;

        return model.Advertisement.findAll({
          attributes: ['id', 'title','description','video_thumb','video_url'],
          order: sequelize.literal('rand()'),
          limit: 2         
        });
      /*res.status(200).json({
        status: true,
        data: video_data,
        message: '',
        function:"video_details",
      });*/
      
    })  

    .then(advertisements => {
      res.status(200).json({
        status: true,
        data: video_info,
        advertisements: advertisements,
        message: '',
        function:"video_details",
      });
    })

    .catch(err => res.status(403).json({
      status: false,
      error: err.toString()
    }));

} else res.status(403).json({
  "status": false,
  "message": "Unauthorized access",
  "errorcode": "serverError",
  "function":"video_details",
})
},

video_image_list(req, res, next)  {
  if (req.decoded.id) {
    const Op = model.Sequelize.Op;
      let page = req.body.page ? req.body.page : 1;
      let limit = config.limit;
      let offset = limit * page - limit;

    if(req.body.type=='video'){
        model.Videos.findAll({
            attributes: ['id', 'title','description','video_thumb','video_url','location','total_views','total_comments'],
            include: [{
                  model: model.User,
                  attributes: ['first_name', 'last_name','image'],
                  required: true
                }],
            /*where: {
                  user_id: {
                    [Op.eq]: req.decoded.id
                  }
                },
                  */ 
            order:[
             ['id', 'DESC']
            ],
            offset: offset,
            limit: limit        
          })
          .then(videos => {

            res.status(200).json({
              status: true,
              data: videos,
              message: "",
              function:"video_image_list"
            });
            
          })  

          .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"video_image_list"
          }));
    }else if(req.body.type=='image'){

        model.Album.findAll({
            attributes: ['id', 'album_name'],
            include: [
                {
                  model: model.Photos,
                  as:'photos',
                  required: true,
                } ,
                {
                  model: model.User,
                  attributes: ['first_name', 'last_name','image'],
                  required: true
                }          
                ],           
            order:[
             ['id', 'DESC']
            ],
            offset: offset,
            limit: limit        
          })
          .then(photos => {          

            res.status(200).json({
              status: true,
              data: photos,
              message: "",
              function:"video_image_list"
            });
            
          })  

          .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"video_image_list"
          }));
          }else{

      

          client.getImgesVideos(req.body.page,config.limit)
          .then(result => {


              async.forEach(result,function(row,callback) {
                    row.User={first_name:row.first_name,last_name:row.last_name,image:row.image};
                    if(row.type=='video'){
                        row.video_thumb=row.thumb;
                        row.video_url=row.url;
                        delete (row.thumb);
                        delete (row.url);
                        callback();

                    }else{
                      row.album_name=row.title;
                      delete (row.thumb);
                      delete (row.url);
                      delete (row.title);
                      model.Photos.findAll({
                        //attributes: ['id', 'album_name'],
                        
                        where: {
                              album_id: {
                                [Op.eq]: row.id
                              }
                            }, 
                            
                      })
                      .then(photos => {
                        console.log("photos==",photos)
                        row.photos=photos;
                        callback();

                      })
                      .catch(err =>{
                         callback();
                      });
                    }
                    delete (row.first_name);
                    delete (row.last_name);
                    delete (row.image);

                    
               },function done() {
                     res.status(200).json({
                        status: true,
                        data: result,
                        message: "",
                        function:"video_image_list"
                      });
                });

            
          })
         .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"video_image_list"
          }));

    }


  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"video_list"
  })
},

album_details(req, res, next)  {
  if (req.decoded.id) {
    let photo_data=[];
    const Op = model.Sequelize.Op;  

            model.Album.findAll({
            attributes: ['id', 'album_name'],
            include: [
                {
                  model: model.Photos,
                  as:'photos',
                  attributes: ['photo_url'],
                  required: false,
                } ,
                {
                  model: model.User,
                  attributes: ['first_name', 'last_name','image'],
                  required: false
                }          
                ],
            where: {
                  id: {
                    [Op.eq]: req.body.album_id
                  }
                } 
                  
          })
          .then(photos => {
            photo_data=photos;
            return model.Advertisement.findAll({
                attributes: ['id', 'title','description','video_thumb','video_url'],
                order: sequelize.literal('rand()'),
                limit: 2         
              });
            /*
            res.status(200).json({
              status: true,
              data: photos,
              message: "",
              function:"video_image_list"
            });*/
            
          }) 

          .then(advertisements => {
            res.status(200).json({
              status: true,
              data: photo_data,
              advertisements: advertisements,
              message: '',
              function:"video_image_list",
            });
          })

          .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"video_image_list"
          })); 

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"video_list"
  })
},
get_comments(req, res, next)  {
   let page = req.body.page ? req.body.page : 1;
      let limit = config.limit;
      let offset = limit * page - limit;
      let comment_lists=[];

  if (req.decoded.id) {
    const Op = model.Sequelize.Op;
      if(req.body.image_id && req.body.image_id!='' && req.body.image_id!=null){
            model.Comments.findAll({
            attributes: ['comment_id','comment', 'created_at',
            [sequelize.literal(`(select COUNT(id) as likes from comment_reaction_master where comment_id=Comments.comment_id AND type=1)`), 'likes'],
            [sequelize.literal(`(select COUNT(id) as unlikes from comment_reaction_master where comment_id=Comments.comment_id AND type=0)`), 'unlikes'],
            [sequelize.literal(`(select type as my_reaction from comment_reaction_master where comment_id=Comments.comment_id AND user_id=${req.decoded.id})`), 'my_reaction']
            ],
            include: [                
                {
                  model: model.User,
                  attributes: ['first_name', 'last_name','image'],
                  required: false
                }          
                ],
            where: {
                  photo_id: {
                    [Op.eq]: req.body.image_id
                  }
                } ,
            order:[
             ['comment_id', 'DESC']
            ],
            offset: offset,
            limit: limit      
                  
          })
          .then(comment_list => {
            comment_lists=JSON.parse(JSON.stringify(comment_list));
             async.eachSeries(comment_lists, (comment_row, callback) => {  
                  comment_row.created_at=moment(comment_row.created_at, "YYYY-MM-DD HH:mm:ss").fromNow();
                  if(comment_row.my_reaction==1){
                     comment_row.my_reaction='like';
                     callback();
                  }else{
                      comment_row.my_reaction='unlike';
                      callback();
                  } 

             }, function done(){
                      res.status(200).json({
                        status: true,
                        data: comment_lists,
                        message: "",
                        function:"get_comments"
                      });
             });             
              
          }) 

          .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"get_comments"
          })); 
      } else{

        model.Comments.findAll({
            attributes: ['comment_id','comment', 'created_at',
            [sequelize.literal(`(select COUNT(id) as likes from comment_reaction_master where comment_id=Comments.comment_id AND type=1)`), 'likes'],
            [sequelize.literal(`(select COUNT(id) as unlikes from comment_reaction_master where comment_id=Comments.comment_id AND type=0)`), 'unlikes'],
            [sequelize.literal(`(select type as my_reaction from comment_reaction_master where comment_id=Comments.comment_id AND user_id=${req.decoded.id})`), 'my_reaction']
            ],
            include: [                
                {
                  model: model.User,
                  attributes: ['first_name', 'last_name','image'],
                  required: false
                }                        
                ],
            where: {
                  video_id: {
                    [Op.eq]: req.body.video_id
                  }
                } ,
            order:[
             ['comment_id', 'DESC']
            ],
            offset: offset,
            limit: limit      
                  
          })
          .then(comment_list => {
            comment_lists=JSON.parse(JSON.stringify(comment_list));
             async.eachSeries(comment_lists, (comment_row, callback) => {  
                  comment_row.created_at=moment(comment_row.created_at, "YYYY-MM-DD HH:mm:ss").fromNow();
                  if(comment_row.my_reaction==1){
                     comment_row.my_reaction='like';
                     callback();
                  }else{
                      comment_row.my_reaction='unlike';
                      callback();
                  } 

             }, function done(){
                      res.status(200).json({
                        status: true,
                        data: comment_lists,
                        message: "",
                        function:"get_comments"
                      });
             });

              
           

            /*var ctr = 0;
                let comment_list_array=[];

                 comment_lists.forEach(function (comment_row) {
                  ctr++;    

                  if(comment_row.my_reaction=='1'){
                     var my_reaction='like';
                  }else{
                      var my_reaction='unlike';
                  }                 

                  var new_object={
                    comment_id:comment_row.comment_id,
                    //like_count:like_count,
                    unlikes:comment_row.unlikes,
                    my_reaction:my_reaction,
                    first_name:comment_row.first_name,
                    last_name:comment_row.last_name,
                    comment:comment_row.comment,
                    created_at:moment(comment_row.created_at, "YYYY-MM-DD HH:mm:ss").fromNow(),
                    User:comment_row.User,
                  }
                   comment_list_array.push(new_object);
                  if(ctr==comment_list.length){
                     res.status(200).json({
                        status: true,
                        data: comment_list_array,
                        message: "",
                        function:"get_comments"
                      });
                  }
                });
            */
          }) 

          .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"get_comments"
          })); 

      } 



  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"get_comments"
  })
},


add_comment(req, res, next) {
  let comment_id=0;
  if (req.decoded.id) {

    req.checkBody('comment', config.error.errcomment).notEmpty();

    
    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;

      
      let commentData = {
        user_id: req.decoded.id,
        comment: req.body.comment,           
      }

      if(req.body.image_id && req.body.image_id!='' && req.body.image_id!=null){
        commentData.photo_id=req.body.image_id;
      }else{
        commentData.video_id=req.body.video_id;
      }  

      model.Comments.create(commentData)

      .then((inserted) => {
              comment_id=inserted.comment_id;

                      return model.Comments.findOne({
                        attributes: ['comment_id','comment', 'created_at'],
                        include: [                
                        {
                          model: model.User,
                          attributes: ['first_name', 'last_name','image'],
                          required: false
                        }          
                        ],
                        where: {
                          comment_id: {
                            [Op.eq]: inserted.comment_id
                          }
                        }                        
                        
                      })


                    }) 
      .then((chat) => {

        res.status(200).json({
          status: true,
          data: chat,
          comment_id:comment_id,
          message: "Comment added successfully.",
          function:"add_comment"
        });

        if(req.body.image_id && req.body.image_id!='' && req.body.image_id!=null){
          model.Photos.update({ total_comments: sequelize.literal('total_comments + 1') }, { where: { id: req.body.image_id } });
        }else{
          model.Videos.update({ total_comments: sequelize.literal('total_comments + 1') }, { where: { id: req.body.video_id } });
        }
      })

      .catch((err) => {
        res.status(403).json({
          status: false,
          error: err.toString()
        });
      });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"add_comment"
  })

},

contribute(req, res, next) {
  if (req.decoded.id) {
    let chargeObj=""; 
    req.checkBody('video_id', config.error.errVideoId).notEmpty();
    req.checkBody('name', config.error.errName).notEmpty();
    req.checkBody('amount', config.error.errAmount).notEmpty();
    req.checkBody('card_token', config.error.errCardToken).notEmpty();
    
    let err = req.validationErrors();

    if (err == false) {
      let video_id=req.body.video_id;
      let amount=req.body.amount;

      const Op = model.Sequelize.Op;
      stripe = require("stripe")(config.stripe_secret);

      stripe.customers.create({ email: req.decoded.email })

      .then(function (customer) {
          return stripe.customers.createSource(customer.id, {
            source: req.body.card_token,
            metadata: {
              user_id: req.decoded.id
            }
          });
        })

      .then(function (source) {
          return stripe.charges.create(
            {
              amount: req.body.amount * 100,
              currency: "usd",
              customer: source.customer
            },
            {
              idempotency_key: uniqid()
            }
          );
        })

      .then(function (charge) {
          chargeObj = charge;
          var insertData={
              user_id: req.decoded.id,
              video_id: req.body.video_id,
              contributer_name: req.body.name,
              contributer_email: req.decoded.email,
              amount: req.body.amount,
              note: req.body.note,
              created_at: new Date(charge.created),
              charge_object: JSON.stringify(charge)
          }        
        return model.videoEarnings.create(insertData);        
      })
      
      .then((inserted) => {
          return model.Videos.findOne({
                        attributes: ['id', 'total_earning'],                        
                        where: {
                          id: {
                            [Op.eq]: req.body.video_id
                          }
                        }                        
                        
        });
      })
      .then((video) => {

        res.status(200).json({
          status: true,
          data: {},
          message: "contribution added successfully.",
          function:"contribute"
        });        

         const t = video.total_earning ? parseFloat(video.total_earning) + parseFloat(req.body.amount) : parseFloat(req.body.amount);
                  console.log("total_earning", t);  
          video.update({total_earning:t});  

          let email_content = `
                            <div><h1 style="font-family: sans-serif;font-size:40px;text-align:center;color:#4badd3;padding-bottom:50px;margin:0px;">Contribution Payment Successful - Contributer</h1></div>
                            <h2>Thank you for your contribution for video &quot;ID #${video_id}&quot; of $ ${amount}</h2>
                            <p style="font-family: sans-serif;font-size:18px;color:#333;">Hi ${req.decoded.first_name} ${req.decoded.last_name},</p>
                            <p><em>We have received your payment for $ ${amount} that you contributed on <strong>#DATE#</strong>. The payment has been authorized and approved.</em></p>

                            <p>Paymet details :&nbsp;</p>

                            <table align="center" border="1" cellpadding="1" cellspacing="1" style="width:80%">
                              <thead>
                                <tr>
                                  <th scope="col" style="width:20%">Transaction ID</th>
                                  <th scope="col" style="width:15%">Method</th>
                                  <th scope="col" style="width:25%">Date</th>
                                  <th scope="col" style="width:20%">Amount</th>
                                  <th scope="col">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style="text-align:center; vertical-align:middle">${chargeObj.id}</td>
                                  <td style="text-align:center; vertical-align:middle">${chargeObj.source.object}</td>
                                  <td style="text-align:center; vertical-align:middle">${new Date(chargeObj.created)}</td>
                                  <td style="text-align:center; vertical-align:middle">${amount}</td>
                                  <td style="text-align:center; vertical-align:middle">${chargeObj.paid ? "PAID" : "DUE"}</td>
                                </tr>
                              </tbody>
                            </table>
                            `;

                            /*<p style="font-family: sans-serif;font-size:18px;color:#333;">Your account has been created successfully.</p>*/

          let subject = 'Thank you for your contribution for video';
          let send_mail = helperFunc.send_mail(req.decoded.email, subject, email_content);      

                        
        })    
             
      /*.then((chat) => {
        res.status(200).json({
          status: true,
          data: chat,
          message: "Comment added successfully.",
          function:"contribute"
        });
       
      })*/
      
      .catch((err) => {
        res.status(403).json({
          status: false,
          error: err.toString()
        });
      });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"contribute"
  })

},

create_token(req, res, next) {
stripe = require("stripe")(config.stripe_secret);
stripe.tokens.create({
  card: {
    number: '4242424242424242',
    exp_month: 12,
    exp_year: 2020,
    cvc: '123'
  }
}, function(err, token) {
  // asynchronously called

   res.status(200).json({
          status: true,
          data: token,
          err:err,
          function:"create_token"
        });
});
},


my_earnings(req, res, next)  {

  let page = req.body.page ? req.body.page : 1;
      let limit = config.limit;
      let offset = limit * page - limit;

  if (req.decoded.id) {
     let earning_list=[];
     const Op = model.Sequelize.Op;
      model.Videos.findAll({
                        attributes: ['id', 'title', 'description','video_thumb','video_url','location','total_earning','total_views',[sequelize.fn('date_format', sequelize.col('created_at'), '%M %d, %Y %H:%i %p'), 'date']],
                        /*include: [                
                        {
                          model: model.User,
                          attributes: ['first_name', 'last_name','image'],
                          required: false
                        }          
                        ],*/
                        where: {
                          user_id: {
                            [Op.eq]: req.decoded.id
                          }
                        },
                        offset: offset,
                        limit: limit                         
                        
                      })
          .then(result => {
            earning_list=result;
            return  model.Videos.findOne({
                        attributes: [[sequelize.fn('SUM', sequelize.col('total_earning')), 'sub_earning'],[sequelize.literal(`(select count(id) as total_videos from video_master where user_id=${req.decoded.id})`), 'total_videos']],
                        /*include: [                
                        {
                          model: model.User,
                          attributes: ['first_name', 'last_name','image'],
                          required: false
                        }          
                        ],*/
                        where: {
                          user_id: {
                            [Op.eq]: req.decoded.id
                          }
                        }                        
                        
                      });

             
                    /* res.status(200).json({
                        status: true,
                        data: result,
                        message: "",
                        function:"my_earnings"
                      });*/
              

            
          })

          .then(earnings => {

              res.status(200).json({
                        status: true,
                        total:earnings,
                        data: earning_list,
                        message: "",
                        function:"my_earnings"
                      });

          })
         .catch(err => res.status(403).json({
            status: false,
            error: err.toString(),
            function:"my_earnings"
          }));

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"my_earnings"
  })
},

change_password(req, res, next) {
  if (req.decoded.id) {
    console.log("body=======",req.body);
    req.checkBody('old_password', config.error.errOldPass).notEmpty();

    req.checkBody('new_password', config.error.errNewPass).notEmpty();

    req.checkBody('confirm_password', config.error.errConfirmPass).notEmpty();

    if (req.body.new_password != req.body.confirm_password) res.status(403).json({
      status: false,
      error: config.error.passMissmatch
    });

    let err = req.validationErrors();
    if (err == false) {

      const Op = model.Sequelize.Op;

      model.User.findOne({
          attributes: ['id', 'unique_id', 'password'],
          where: {
            id: {
              [Op.eq]: req.decoded.id
            }
          }
        })
        .then(userInfo => {
          let user = JSON.parse(JSON.stringify(userInfo));
           console.log(user);
          let password = helperFunc.decryptPassword(user.password, config.encryptAlgorithm, config.algorithmSecret);

          if (password != req.body.old_password) res.status(200).json({
            status: false,
            error: config.error.oldPassIncorrect
          });

          else {
            return userInfo.update({
              password: helperFunc.encryptPassword(req.body.new_password, config.encryptAlgorithm, config.algorithmSecret)
            });

          }
        })

        .then(function (record) {
          res.status(200).json({
            status: true,
            data: {},
            message: config.success.changePasswordMsg,
            function: "change_password"
          });
        })

        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });
    }else{
      res.status(403).json({
        "status": false,
        "message": "Unauthorized access",
        "errorcode": "serverError",
        "function":"change_password"
      })
    }
  },

  notifications(req, res, next) {
  if (req.decoded.id) {   

      let page = req.body.page ? req.body.page : 1;
      let limit = config.limit;
      let offset = limit * page - limit;

      const Op = model.Sequelize.Op;

      model.Notifications.findAll({
          attributes: ['id', 'title', 'message',[sequelize.fn('date_format', sequelize.col('created_at'), '%M %d, %Y %H:%i %p'), 'date']],
          where: {
            user_id: {
              [Op.eq]: req.decoded.id
            }
          },
          order:[
             ['id', 'DESC']
            ],
          offset: offset,
          limit: limit  
        })
        
        .then(function (records) {
          res.status(200).json({
            status: true,
            data: records,
            message: '',
            function: "notifications"
          });
        })

        .catch(err => res.status(403).json({
          status: false,
          error: err.toString()
        }));

   
    }else{
      res.status(403).json({
        "status": false,
        "message": "Unauthorized access",
        "errorcode": "serverError",
        "function":"notifications"
      })
    }
  },

  react_comment(req, res, next) {
    let data={};
  if (req.decoded.id) {

    req.checkBody('comment_id', config.error.errcommentId).notEmpty();

    req.checkBody('reaction', config.error.errreaction).notEmpty();
    
    let err = req.validationErrors();

    if (err == false) {

      const Op = model.Sequelize.Op;    
     
      //model.Comments.create(commentData)

      return model.CommentReaction.findOne({
                        attributes: ['id'],                        
                        where: {
                          comment_id: {
                            [Op.eq]: req.body.comment_id
                          },
                          user_id:{
                            [Op.eq]: req.decoded.id
                          }
                        }                        
                        
                      })

      .then((result) => {
              if(result){               
                  if(req.body.reaction=='like'){
                     var type=1;
                  }else{
                     var type=0;
                  }
                result.update({type:type,reacted_at:moment().utc().format("YYYY-MM-DD HH:mm:ss")});
                   
              }else{

                if(req.body.reaction=='like'){
                   var type=1;
                }else{
                   var type=0;
                }
                 var reactionData={
                      user_id:req.decoded.id,
                      comment_id:req.body.comment_id,
                      type:type,
                      reacted_at:moment().utc().format("YYYY-MM-DD HH:mm:ss"),
                 };
                model.CommentReaction.create(reactionData);
              }

              return model.Comments.findOne({
                        attributes: ['comment_id','comment','video_id','photo_id','user_id',[sequelize.literal(`(select COUNT(id) as likes from comment_reaction_master where comment_id=Comments.comment_id AND type=1)`), 'likes'],
            [sequelize.literal(`(select COUNT(id) as unlikes from comment_reaction_master where comment_id=Comments.comment_id AND type=0)`), 'unlikes'],
            [sequelize.literal(`(select type as my_reaction from comment_reaction_master where comment_id=Comments.comment_id AND user_id=${req.decoded.id})`), 'my_reaction']
            ], 
                        include: [                
                        {
                          model: model.Photos,
                          attributes: ['title','user_id'],
                          required: false,
                            
                        } ,{
                          model: model.Videos,
                          attributes: ['title','user_id'],
                          required: false,
                         
                        }        
                        ],                       
                        where: {
                          comment_id: {
                            [Op.eq]: req.body.comment_id
                          }                          
                        }                        
                        
                      });  
      }) 
      .then((comment_data) => {
         /*         if(comment_data.my_reaction==1){
                     comment_data.my_reaction='like';
                  }else{
                      comment_data.my_reaction='unlike';
                  }*/ 

         /* res.status(200).json({
            status: true,
            data: comment_data,
            message: "Success.",
            function:"react_comment"
          }); */

        if(comment_data.photo_id !== null && comment_data.photo_id !== '') {
                  if(req.body.reaction=='like'){
                     var message=req.decoded.first_name+' '+req.decoded.last_name+' liked your comment on post "'+comment_data.Photos.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' liked your comment.';

                    var message1=req.decoded.first_name+' '+req.decoded.last_name+' liked a comment on your post "'+comment_data.Photos.title+'".';
                    var title1=req.decoded.first_name+' '+req.decoded.last_name+' liked a comment.';

                  }else{
                     var message=req.decoded.first_name+' '+req.decoded.last_name+' disliked your comment on post "'+comment_data.Photos.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' disliked your comment.';

                     var message1=req.decoded.first_name+' '+req.decoded.last_name+' disliked a comment on your post "'+comment_data.Photos.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' disliked a comment.';
                  }

                var notificationData={
                      user_id:comment_data.user_id,
                      title:title,
                      message:message,                      
                 };
                 model.Notifications.create(notificationData);

                var notificationData1={
                      user_id:comment_data.Photos.user_id,
                      title:title1,
                      message:message1,                      
                 };
                 model.Notifications.create(notificationData1);
        }else{
                  if(req.body.reaction=='like'){
                     var message=req.decoded.first_name+' '+req.decoded.last_name+' liked your comment on post "'+comment_data.Video.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' liked your comment.';

                    var message1=req.decoded.first_name+' '+req.decoded.last_name+' liked a comment on your post "'+comment_data.Video.title+'".';
                    var title1=req.decoded.first_name+' '+req.decoded.last_name+' liked a comment.';

                  }else{
                     var message=req.decoded.first_name+' '+req.decoded.last_name+' disliked your comment on post "'+comment_data.Video.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' disliked your comment.';

                     var message1=req.decoded.first_name+' '+req.decoded.last_name+' disliked a comment on your post "'+comment_data.Video.title+'".';
                     var title=req.decoded.first_name+' '+req.decoded.last_name+' disliked a comment.';
                  }

                var notificationData={
                      user_id:comment_data.user_id,
                      title:title,
                      message:message,                      
                 };
                 model.Notifications.create(notificationData);

                var notificationData1={
                      user_id:comment_data.Video.user_id,
                      title:title1,
                      message:message1,                      
                 };
                 model.Notifications.create(notificationData1);

        }

        return model.Comments.findOne({
                        attributes: ['comment_id','comment',[sequelize.literal(`(select COUNT(id) as likes from comment_reaction_master where comment_id=Comments.comment_id AND type=1)`), 'likes'],
            [sequelize.literal(`(select COUNT(id) as unlikes from comment_reaction_master where comment_id=Comments.comment_id AND type=0)`), 'unlikes'],
                        ], 
                                            
            where: {
              comment_id: {
                [Op.eq]: req.body.comment_id
              }                          
            }                        
            
          }) 
              
      })

      .then((comment_return) => {
          data=comment_return;
          res.status(200).json({
            status: true,
            data: data,
            my_reaction:req.body.reaction,
            message: "Success.",
            function:"react_comment"
          }); 
        })

      .catch((err) => {
        res.status(403).json({
          status: false,
          error: err.toString()
        });
      });

    } else res.status(403).json({
      status: false,
      error: (err.hasOwnProperty('length') ? err[0].msg : '')
    });

  } else res.status(403).json({
    "status": false,
    "message": "Unauthorized access",
    "errorcode": "serverError",
    "function":"react_comment"
  })

},

}
module.exports = handler;
