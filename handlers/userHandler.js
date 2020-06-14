let express = require("express"),
  app = express(),
  jwt = require("jsonwebtoken"),
  moment = require("moment"),
  randToken = require("rand-token"),
  jsonfile = require("jsonfile"),
  fs = require("fs"),
  config = require("../server/config"),
  user = require("../dao/userDao"),
  functions = require("../helpers/functions"),
  emailValidator = require("email-validator"),
  uniqid = require("uniqid"),
  formidable = require("formidable"),
  path = require("path"),
  apn = require("apn"),
  stripe = require("stripe")(config.your_stripe_api_key),
  request = require('request');

// data = fs.readFileSync('base64', 'utf8'),
// base64Data,
// binaryData;
let options = {
  token: {
    key: "AuthKey_P9WJM5T36G.p8",
    keyId: "P9WJM5T36G",
    teamId: "AWTTDM87PD"
  },
  production: false
};
let apnProvider = new apn.Provider(options);
var AWS = require('aws-sdk');

let handler = {
  index(req, res, next) {
    res.send("respond with a resource");
  },
  login(req, res, next) {

    let userDetails = {};
    let userData = {};
    if (!req.body.email && !req.body.facebook_token)
      res.json({
        status: false,
        message: " Email is required.",
        errorcode: "validationError",
        function: "login"
      });
    else if (
      !req.body.password &&
      !req.body.facebook_token &&
      !req.body.google_token
    )
      res.json({
        status: false,
        message: "Password is required.",
        errorcode: "validationError",
        function: "login"
      });
    else {
      if (req.body.facebook_token) {
        user
          .getUserByFb(req.body.facebook_token)
          .then(user_data => {
            userData =
              user_data.length > 0
                ? JSON.parse(JSON.stringify(user_data[ 0 ]))
                : {};
            let last_login = moment().utc().format("YYYY-MM-DD HH:mm:ss");
            if (!user_data.length)
              res.json({
                status: false,
                message: "User does not exist",
                errorcode: "validationError",
                function: "login"
              });
            else if (user_data[ 0 ].active != "Y")
              res.json({
                status: false,
                message: "Your Account is not activated. Please contact Admin",
                errorcode: "validationError",
                function: "login"
              });
            else
              return functions.update(
                "user_master",
                { last_login: last_login },
                { id: userData.id }
              );
          })
          .then(updateRes => {
            if (!updateRes.affectedRows) throw "Database error.";
            else return user.getUserById(userData.id);
          })
          .then(result => {
            if (result.length) {
              userDetails =
                result.length > 0 ? JSON.parse(JSON.stringify(result[ 0 ])) : {};

              let token = jwt.sign({
                id: userDetails.id,
                user_id: userDetails.user_id,
                first_name: userDetails.first_name,
                last_name: userDetails.last_name,
                email: userDetails.email
              }, config.secret, {
                expiresIn: 2592000
              });

              let refreshToken = randToken.uid(256);

              functions.createRefreshTokenJsonFile(userDetails, refreshToken);

              res.setHeader("RefreshToken", refreshToken);

              res.setHeader("AuthToken", token);

              res.setHeader("Authentication", true);
              delete userDetails[ "user_id" ];
              delete userDetails[ 'password' ];
              res.json({
                status: true,
                message: "Logged in successfully.",
                data: userDetails,
                function: "login"
              });
            } else throw "Database error.";
          })
          .catch(err => {
            res.json({ status: false, message: err, function: "login" });
          });
      } else if (req.body.google_token) {
        user
          .getUserByGoogle(req.body.google_token)
          .then(user_data => {
            userData =
              user_data.length > 0
                ? JSON.parse(JSON.stringify(user_data[ 0 ]))
                : {};
            let last_login = moment().utc().format("YYYY-MM-DD HH:mm:ss");
            if (!user_data.length)
              res.json({
                status: false,
                message: "User does not exist",
                errorcode: "validationError",
                function: "login"
              });
            else if (user_data[ 0 ].active != "Y")
              res.json({
                status: false,
                message: "Your Account is not activated. Please contact Admin",
                errorcode: "validationError",
                function: "login"
              });
            else
              return functions.update(
                "user_master",
                { last_login: last_login },
                { id: userData.id }
              );
          })
          .then(updateRes => {
            if (!updateRes.affectedRows) throw "Database error.";
            else return user.getUserById(userData.id);
          })
          .then(result => {
            if (result.length) {
              userDetails =
                result.length > 0 ? JSON.parse(JSON.stringify(result[ 0 ])) : {};

              let token = jwt.sign({
                id: userDetails.id,
                user_id: userDetails.user_id,
                first_name: userDetails.first_name,
                last_name: userDetails.last_name,
                email: userDetails.email
              }, config.secret, {
                expiresIn: 2592000
              });

              let refreshToken = randToken.uid(256);

              functions.createRefreshTokenJsonFile({
                id: userDetails.id,
                user_id: userDetails.user_id,
                first_name: userDetails.first_name,
                last_name: userDetails.last_name,
                email: userDetails.email
              }, refreshToken);

              res.setHeader("RefreshToken", refreshToken);

              res.setHeader("AuthToken", token);

              res.setHeader("Authentication", true);
              delete userDetails[ "user_id" ];
              delete userDetails[ 'password' ];
              res.json({
                status: true,
                message: "Logged in successfully.",
                data: userDetails,
                function: "login"
              });
            } else throw "Database error.";
          })
          .catch(err => {
            res.json({ status: false, message: err, function: "login" });
          });
      } else {
        user
          .getUserByUserName(req.body.email)
          .then(user_data => {
            userData =
              user_data.length > 0
                ? JSON.parse(JSON.stringify(user_data[ 0 ]))
                : {};

            let password = functions.decryptPass(userData.password);

            let last_login = moment().utc().format("YYYY-MM-DD HH:mm:ss");
            if (!user_data.length) {

              res.json({
                status: false,
                message: "User does not exist",
                errorcode: "validationError",
                function: "login"
              });
            }
            else if (password != req.body.password) {
              res.json({
                status: false,
                message: "Incorrect Password",
                errorcode: "validationError",
                function: "login"
              });

            }
            else if (user_data[ 0 ].email_verified != "Y") {

              res.activated = false;
              req.data = user_data;
              throw "Your Account is not activated. Please verify your email."
            }
            else {

              return functions.update(
                "user_master",
                { last_login: last_login },
                { id: userData.id }
              ).catch(err => {
                logger(err)
              })
            }
          })
          .then(updateRes => {

            if (!updateRes.affectedRows) throw "Database error.";
            else return user.getUserById(userData.id);
          })
          .then(result => {
            if (result.length) {
              userDetails =
                result.length > 0 ? JSON.parse(JSON.stringify(result[ 0 ])) : {};

              let paramss = {
                user_id: userDetails[ "user_id" ],
                email: userDetails[ 'email' ]
              }

              let token = jwt.sign({
                id: userDetails.id,
                user_id: userDetails.user_id,
                first_name: userDetails.first_name,
                last_name: userDetails.last_name,
                email: userDetails.email
              }, config.secret, {
                expiresIn: 2592000
              });


              let refreshToken = randToken.uid(256);

              functions.createRefreshTokenJsonFile(userDetails, refreshToken);

              res.setHeader("RefreshToken", refreshToken);

              res.setHeader("AuthToken", token);

              res.setHeader("Authentication", true);
              delete userDetails[ "user_id" ];
              delete userDetails[ 'password' ];
              res.json({
                status: true,
                message: "Logged in successfully.",
                data: userDetails,
                function: "login"
              });
            } else throw "Database error.";
          })
          .catch(err => {
            console.log("wewwewew:", err);
            console.log("reqwqq", req.data);
            if (!req.activated) {
              res.json({
                status: false,
                message: "Your Account is not activated. Please verify your email.",
                errorcode: "ActivationError",
                userData: req.data,
                function: "login"
              });
            } else {
              res.json({ status: false, message: err, function: "login" });
            }
          });
      }
    }
  },

  async register(req, res, next) {
    if (!req.body.first_name)
      res.json({
        status: false,
        message: "First name is required",
        errorcode: "validationError",
        function: "sign_up"
      });
    else if (!req.body.last_name)
      res.json({
        status: false,
        message: "User Name is required",
        errorcode: "validationError",
        function: "sign_up"
      });
    else if (
      !req.body.facebook_token &&
      !emailValidator.validate(req.body.email)
    )
      res.json({
        status: false,
        message: "Invalid email",
        errorcode: "validationError",
        function: "sign_up"
      });
    else if (
      !req.body.password &&
      !req.body.facebook_token &&
      !req.body.google_token
    )
      res.json({
        status: false,
        message: "Password is required",
        errorcode: "validationError",
        function: "sign_up"
      });
    else {
      let reg_details = {};
      let user_details = {};
      if (req.body.facebook_token) {
        reg_details = req.body;
        reg_details.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");

        reg_details.unique_id = uniqid();

        user_details = {
          first_name: reg_details.first_name,
          last_name: reg_details.last_name,
          email: reg_details.email,
          // password: reg_details.password,
          created_at: reg_details.created_at,
          unique_id: reg_details.unique_id,
          image: reg_details.profile_image,
          user_type: 1,
          facebook_token: reg_details.facebook_token
          // google_token:reg_details.google_token
        };
      } else if (req.body.google_token) {
        reg_details = req.body;

        // reg_details.password = functions.encryptPass(reg_details.password);

        reg_details.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");

        reg_details.unique_id = uniqid();

        // reg_details.ip_addr = req.connection.remoteAddress.split(':').pop();

        user_details = {
          first_name: reg_details.first_name,
          last_name: reg_details.last_name,
          email: reg_details.email,
          created_at: reg_details.created_at,
          unique_id: reg_details.unique_id,
          image: reg_details.image,
          user_type: 1,
          google_token: reg_details.google_token
        };
      } else {
        reg_details = req.body;

        reg_details.password = functions.encryptPass(reg_details.password);

        reg_details.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");

        reg_details.unique_id = uniqid();

        // reg_details.ip_addr = req.connection.remoteAddress.split(':').pop();

        user_details = {
          first_name: reg_details.first_name,
          last_name: reg_details.last_name,
          email: reg_details.email,
          created_at: reg_details.created_at,
          unique_id: reg_details.unique_id,
          // image:reg_details.image,
          password: reg_details.password,
          user_type: 1
          // google_token:reg_details.google_token
        };
      }
      try {
        const existuser = await user.getUserByUserName(reg_details.email)
        console.log("aaaaaaaaaaaaa", existuser)
        if (existuser.length > 0) {
          throw "Email already exist";
        }
        else {

          if (user_details.image) {
            const filename = new Date().valueOf().toString()
            const downloadedImage = await new Promise((resolve, reject) => {
              request(user_details.image).
                pipe(fs.createWriteStream(`public/uploads/${filename}`)).
                on('close', (a, b) => {
                  resolve({ a, b })
                });
            })
            let data = await new Promise((resolve, reject) => {
              fs.readFile(`public/uploads/${filename}`, (err, data) => {
                if (err) {
                  reject(err)
                }
                else {
                  resolve(data)
                }
              })
            })


            const config = await functions.get("general_config")

            const awsConfig = (function gen(input = [ "s3bucket_bucketName", "s3bucket_accessKeyId", "s3bucket_secretAccessKey" ]) {
              let obj = {};
              input.forEach((item) => {
                obj[ item ] = config.find(con => con.field == item).value
              })
              return obj
            })()

            const params = {
              Key: filename,
              Body: data,
              Bucket: awsConfig.s3bucket_bucketName
            };

            const s3bucket = new AWS.S3({
              accessKeyId: awsConfig.s3bucket_accessKeyId,
              secretAccessKey: awsConfig.s3bucket_secretAccessKey,
            });



            const uploadS3Result = await new Promise((resolve, reject) => {
              s3bucket.upload(params, function (err, data) {
                if (err) {
                  reject(err)
                } else {
                  resolve(data)
                }
              });
            })

            if (uploadS3Result) {
              user_details.profile_image = uploadS3Result.Key
            }

          }

          const result = await functions.insert("user_master", user_details);

          if (req.body.newsletter == true) {
            await functions.insert("subscription_master", { email_id: req.body.email });
          }

          if (result.insertId && !req.body.facebook_token && !req.body.google_token) {
            req.body.user_id = result.insertId;
            handler.verifyemail(req, res, next);
          }

          res.json({
            status: true,
            message: 'registered successfully',
            function: "register"
          });
        }
      }
      catch (err) {
        console.log(err)
        res.json({
          status: false,
          message: err,
          errorcode: "serverError",
          function: "register"
        });
      }
    }
  },

  getStates(req, res, next) {
    functions
      .get("state_master", {})
      .then(states => {
        res.json({ status: true, message: "State List", states: states });
      })
      .catch(err => {
        console.log(err);
        res.json({
          status: false,
          message: err,
          errorcode: "serverError",
          function: "register"
        });
      });
  },
  async updateProfile(req, res, next) {
    if (!req.body.user_id) res.json({ status: false, message: "Invalid User" });
    else {
      const userDetail = await functions.get("user_master", { id: req.decoded.user_id })
      let data = {};
      if (
        userDetail && userDetail instanceof Array && userDetail.length > 0) {
        let data = {
          zip_code: req.body.zip_code,
          city: req.body.city,
          state_id: req.body.state_id,
          my_dream: req.body.description,
          profile_image: req.body.profile_image
        };
        if (req.body.profile_image) {
          functions
            .update("user_master", data, { id: req.body.user_id })
            .then(rs => {
              if (!rs.affectedRows) throw "Database error.";
              else return user.getUserById(req.body.user_id);
            })
            .then(userDetails1 => {
              if (!userDetails1.length) throw "Database error.";
              else
                return res.json({
                  status: true,
                  message: "Profile updated successfully",
                  userDetails: userDetails1
                });
            })
            .catch(err => {
              res.json({
                status: false,
                message: err,
                errorcode: "serverError"
              });
            });
        } else {
          let data = {
            zip_code: req.body.zip_code,
            city: req.body.city,
            state_id: req.body.state_id,
            my_dream: req.body.description
          };
          functions
            .update("user_master", data, { id: req.body.user_id }, function (
              rs
            ) { })
            .then(rs => {
              if (!rs.affectedRows) throw "Database error.";
              else return user.getUserById(req.body.user_id);
            })
            .then(userDetails1 => {
              if (!userDetails1.length) throw "Database error.";
              else
                return res.json({
                  status: true,
                  message: "Profile updated successfully",
                  userDetails: userDetails1
                });
            })
            .catch(err => {
              console.log(err);
              res.json({
                status: false,
                message: err,
                errorcode: "serverError"
              });
            });
        }
      }
    }
  },
  updateGeneral(req, res, next) {
    if (!req.body.user_id) res.json({ status: false, message: "Invalid User" });
    else {
      let data = {
        first_name: req.body.first_name,
        last_name: req.body.last_name
      };
      functions
        .update("user_master", data, { id: req.body.user_id }, function (rs) { })
        .then(rs => {
          if (!rs.affectedRows) throw "Database error.";
          else return user.getUserById(req.body.user_id);
        })
        .then(async (userDetails) => {
          if (req.body.subcribe_to_newsletter === "Y" || req.body.subcribe_to_newsletter === "N") {

            try {


              const subscription = await functions.get("subscription_master", {
                email_id: userDetails[ 0 ].email
              })

              if (subscription instanceof Array && subscription.length > 0) {
                await functions.update("subscription_master", {
                  is_unsubscribed: req.body.subcribe_to_newsletter === "Y" ? 1 : 0
                }, {
                  email_id: userDetails[ 0 ].email
                })
              }
              else {
                await functions.insert("subscription_master", {
                  is_unsubscribed: req.body.subcribe_to_newsletted === "Y" ? 1 : 0,
                  email_id: userDetails[ 0 ].email
                })
              }

              return userDetails
            }
            catch (err) {
              throw new Error()
            }
          }
          return userDetails
        })
        .then(userDetails => {
          if (!userDetails.length) throw "Database error.";
          else
            return res.json({
              status: true,
              message: "Profile updated successfully",
              userDetails: userDetails
            });
        })
        .catch(err => {
          console.log(err);
          res.json({ status: false, message: err, errorcode: "serverError" });
        });
    }
  },
  forgot_password(req, res, next) {
    if (!req.body.user_id) res.json({ status: false, message: "Invalid User" });
    else var params = {
      Key: req.file.filename, //file.name doesn't exist as a property
      Body: data,
      ContentType: req.file.mimetype
    };
    var s3bucket = new AWS.S3({
      params: {
        Bucket: config.secure_file_bucket_name
      }
    }); {
      let reset_code = Math.floor(Math.random() * (9999 - 1000) + 1000);
      let email_content = `<h3>Forgot Password</h3>
            
            <p>Hi ${req.body.first_name} ${req.body.last_name},</p>
            
            <p>Please use below code to reset your <strong>VacationMe</strong> account password.</p>
            
            <p>&nbsp;</p>
            
            <p><strong>Reset Code : ${reset_code}</strong></p>
            
            <p><strong>Thanks,</strong><br />
            <strong>VacationMe Team.</strong></p>
            `;

      functions
        ._send(req.body.email, "VacationMe : Forgot Password", email_content)
        .then(result => {
          console.log(result, "aaaaa");
          if (result) {
            functions
              .update(
                "user_master",
                { reset_code: reset_code },
                { id: req.body.user_id },
                function (rs) { }
              )
              .then(rs => {
                if (!rs.affectedRows) throw "Database error.";
                else
                  return res.json({
                    status: true,
                    message: "Verification code send successfully"
                  });
              })
              .catch(err => {
                console.log(err);
                res.json({
                  status: false,
                  message: err,
                  errorcode: "serverError"
                });
              });
          } else throw "database error";
        });
    }
  },
  verify_code(req, res, next) {
    if (!req.body.user_id) res.json({ status: false, message: "Invalid User" });
    else {
      functions
        .get("user_master", {
          reset_code: req.body.verification_code,
          id: req.body.user_id
        })
        .then(result => {
          if (result.length) {
            return functions.update(
              "user_master",
              {
                reset_code: null,
                email_verified: "Y"
              },
              { id: req.body.user_id }
            );
          } else throw "Invalid Code";
        })
        .then(result => {
          if (result.affectedRows) {
            return res.json({
              status: true,
              message: "Code verified successfully."
            });
          }
        })
        .catch(err => {
          res.json({
            status: false,
            message: err,
            errorcode: "serverError"
          });
        });
    }
  },
  reset_password(req, res, next) {
    console.log(req.body);
    if (!req.body.user_id) res.json({ status: false, message: "Invalid User" });
    else {
      if (!req.body.curPassword) {
        let password = functions.encryptPass(req.body.password);
        functions
          .update(
            "user_master",
            { password: password },
            { id: req.body.user_id }
          )
          .then(result => {
            if (result.affectedRows) {
              return res.json({
                status: true,
                message: "Password updated successfully"
              });
            } else throw "Invalid Reset Code";
          });
      } else {
        let curPassword = functions.encryptPass(req.body.curPassword);
        let password = functions.encryptPass(req.body.password);
        functions.get("user_master", { password: curPassword }).then(result => {
          if (result.length) {
            functions
              .update(
                "user_master",
                { password: password },
                { id: req.body.user_id }
              )
              .then(result => {
                if (result.affectedRows) {
                  return res.json({
                    status: true,
                    message: "Password updated successfully"
                  });
                } else throw "Invalid Reset Code";
              });
          } else
            res.json({ status: false, message: "Invalid Current Password" });
        });
      }
    }
  },

  verifyemail(req, res, next) {
    let reset_code = Math.floor(Math.random() * (9999 - 1000) + 1000);
    let email_content = `${config.email_header} 
            <p>Hi, ${req.body.first_name} ${req.body.last_name}</p>
            <h2>Your verification code is ${reset_code}</h2> ${
      config.email_footer
      }`;
    req.body.user_id = req.body.user_id ? req.body.user_id : req.body.id;
    functions
      ._send(req.body.email, "Email Verification", email_content)
      .then(result => {
        if (result) {
          functions
            .update(
              "user_master",
              { reset_code: reset_code },
              { id: req.body.user_id }
            )
            .then(rs => {
              console.log("rs", rs)
              if (!rs.affectedRows) throw "Database error.";
              else
                return res.json({
                  status: true,
                  message: "Verification code send successfully",
                  data: { user_id: req.body.user_id }
                });
            })
            .catch(err => {
              res.json({
                status: false,
                message: err,
                errorcode: "serverError"
              });
            });
        } else throw "database error";
      }).catch(err => {
        res.json({
          status: false,
          message: err,
          errorcode: "serverError"
        });
      });
  },

  sendCode(req, res, next) {
    let reset_code = Math.floor(Math.random() * (9999 - 1000) + 1000);
    let email_content = `<h3>Forgot Password</h3>
        
        <p>Hi,</p>
        
        <p>Please use below code to reset your <strong>VacationMe</strong> account password.</p>
        
        <p>&nbsp;</p>
        
        <p><strong>Reset Code : ${reset_code}</strong></p>
        
        <p><strong>Thanks,</strong><br />
        <strong>VacationMe Team.</strong></p>`;

    functions
      ._send(req.body.email, "VacationMe : Forgot Password", email_content)
      .then(result => {
        // console.log(result,'aaaaa');
        if (result) {
          functions
            .update(
              "user_master",
              { reset_code: reset_code },
              { email: req.body.email },
              function (rs) { }
            )
            .then(rs => {
              if (!rs.affectedRows) throw "Invalid Email";
              else
                return res.json({
                  status: true,
                  message: "Verification code sent successfully."
                });
            })
            .catch(err => {
              res.json({
                status: false,
                message: err,
                errorcode: "serverError"
              });
            });
        } else throw "Invalid Email";
      });
  },
  checkFrgtVerification(req, res, next) {
    // if(req.body.email){
    functions
      .get("user_master", { reset_code: req.body.verification_code })
      .then(result => {
        // console.log(result,'resultttrttttt');
        if (result.length) {
          return res.json({
            status: true,
            message: "Code verified successfully."
          });
        } else throw "Invalid Code";
      })
      .catch(err => {
        res.json({
          status: false,
          message: err,
          errorcode: "serverError"
        });
      });
  },
  frgt_reset_password(req, res, next) {
    // console.log(req.body);
    let password = functions.encryptPass(req.body.password);
    functions
      .update("user_master", { password: password }, { email: req.body.email })
      .then(result => {
        // console.log(result,'resultttrttttt');
        if (result.affectedRows) {
          return res.json({
            status: true,
            message: "Password updated successfully."
          });
        } else throw "Invalid Reset Code";
      })
      .catch(err => {
        res.json({
          status: false,
          message: err,
          errorcode: "serverError"
        });
      });
  },
  updatePushObject(req, res, next) {
    console.log(req.body, req.decoded, req.user_id)
    let params = req.body;
    params.user_id = req.decoded.id;
    if (params.user_id)
      user.updatePushObject(params)
        .then(result => {
          console.log(result);
          if (result.affectedRows)
            res.json({
              status: true,
              message: 'Successfullly updated notification push object'
            });
          else
            res.json({
              states: false,
              message: 'Push object updation failed!'
            })
        })
        .catch(err => {
          console.log(err);
          res.json({
            states: false,
            message: err.message
          })
        })
    else
      res.json({
        status: false,
        message: 'No user found!'
      })
  },
  async deleteAccount(req, res, next) {
    try {

      const updateResult = await functions.update("user_master", {
        deleted_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
      }, {
        id: req.decoded.user_id
      })

      if (updateResult.affectedRows) {
        res.json({
          status: true
        })
      }

    }
    catch (err) {
      console.log(err)
      res.json({
        status: false,
        message: "something went wrong"
      })

    }
  },
  async content(req, res, next) {
    try {
      const content = await functions.get('cms_master', { name: req.query.name })

      res.json({
        content: content ? content : '',
        status: true
      })

    }
    catch (err) {
      res.json({
        status: false
      })
    }
  },
  getUserPoints(req, res, next) {
    functions
      user.getUserPoints(req.decoded.id)
      .then(walletData => {
        res.json({ status: true, message: "Point Data By Id", walletData: walletData });
      })
      .catch(err => {
        console.log(err);
        res.json({
          status: false,
          message: err,
          errorcode: "serverError",
          function: "register"
        });
      });
    }
};

module.exports = handler;
