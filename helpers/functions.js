let connectionProvider = require("../server/dbConnectionProvider"),
  crypto = require("crypto"),
  merge = require("merge"),
  fs = require("fs"),
  mysql = require("mysql"),
  jsonfile = require("jsonfile"),
  config = require("../server/config"),
  nodemailer = require("nodemailer"),
  jwt = require("jsonwebtoken"),
  FCM = require("fcm-push"),
  fcm = new FCM(config.fcm_key),
  webpush = require("web-push"),
  AWS = require("aws-sdk");

const BUCKET_NAME = process.env.BUCKET_NAME;
const IAM_USER_KEY = process.env.IAM_USER_KEY;
const IAM_USER_SECRET = process.env.IAM_USER_SECRET;
const vapidKeys = config.VAPID;
webpush.setVapidDetails(
  "mailto:jasif@newagesmb.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
webpush.setGCMAPIKey(config.fcm_key);

let s3bucket = new AWS.S3({
  accessKeyId: IAM_USER_KEY,
  secretAccessKey: IAM_USER_SECRET,
  Bucket: BUCKET_NAME
});

let functions = {
  uploadToS3(file) {
    return new Promise((resolve, reject) => {
      s3bucket.createBucket(function() {
        var params = {
          Bucket: BUCKET_NAME,
          Key: file.name,
          Body: file.data
        };
        s3bucket.upload(params, function(err, data) {
          if (err) {
            reject(err);
          }
          resolve(data);
          console.log(data);
        });
      });
    });
  },

  get(table, cond) {
    var self = this;
    var sql = "SELECT * FROM " + table;
    if (typeof cond == "object") {
      sql += " WHERE ";
      for (var key in cond) {
        sql += key + " = '" + cond[key] + "' AND ";
      }
      sql = sql.substring(0, sql.length - 4);
    }
    return self.selectQuery(sql);
  },
  insert(table, data) {
    var self = this;
    var sql = "INSERT INTO " + table + " SET ?";
    // console.log(sql,'dddddddddddd');
    // console.log(data,'dataaaaaaaaaa');
    if (typeof data == "object") {
      return self.processQuery(sql, data);
    } else {
      return false;
    }
  },

  insertMultiple(table, keys, values) {
    var self = this;
    let sql = "INSERT INTO ?? " + keys + " VALUES ?";
    let params = [table, values];
    return self.processQuery(sql, params);
  },

  update(table, fields, cond) {
    var self = this;
    var sql = "UPDATE " + table + " SET ";
    for (var key in fields) {
      sql += key + " = ?,";
    }
    sql = sql.substring(0, sql.length - 1) + " WHERE ";

    for (var ky in cond) {
      sql += ky + " = ? AND ";
    }
    sql = sql.substring(0, sql.length - 4);

    var original = merge(fields, cond);
    var data = [];
    for (var attr in original) {
      data.push(original[attr]);
    }

    return self.processQuery(sql, data);
  },
  delete(table, cond) {
    var self = this;
    var sql = "DELETE FROM " + table + " WHERE 1";
    if (typeof cond == "object") {
      for (var key in cond) {
        sql += " AND " + key + "='" + cond[key] + "'";
      }
      return self.selectQuery(sql);
    } else {
      return false;
    }
  },
  selectQuery(sql) {
    return new Promise((resolve, reject) => {
      let connection = connectionProvider.dbConnectionProvider.getMysqlConnection();
      connection.query(sql, (err, result) => {
        // console.log("select", err, result);
        if (err) reject(err);
        else resolve(result);
      });
      connectionProvider.dbConnectionProvider.closeMysqlConnection(connection);
    });
  },
  processQuery(sql, data) {
    return new Promise((resolve, reject) => {
      let connection = connectionProvider.dbConnectionProvider.getMysqlConnection();
      connection.query(sql, data, (err, result) => {
       
        if (err) reject(err);
        else resolve(result);
      });
      connectionProvider.dbConnectionProvider.closeMysqlConnection(connection);
    });
  },
  getCount(table, cond) {
    var self = this;
    var sql = "SELECT count(*) as count FROM " + table;
    if (typeof cond == "object") {
      sql += " WHERE ";
      for (var key in cond) {
        sql += key + "= '" + cond[key] + "' AND ";
      }
      sql = sql.substring(0, sql.length - 4);
    }
    return self.selectQuery(sql);
  },
  encryptPass(password) {
    if (password != undefined) {
      let cipher = crypto.createCipher(
        config.encrypt_algorithm,
        config.encrypt_pass
      );
      let crypted = cipher.update(password, "utf8", "hex");
      crypted += cipher.final("hex");
      return crypted;
    } else return;
  },
  decryptPass(encrypted) {
    if (encrypted != undefined) {
      let decipher = crypto.createDecipher(
        config.encrypt_algorithm,
        config.encrypt_pass
      );
      let dec = decipher.update(encrypted, "hex", "utf8");
      dec += decipher.final("utf8");
      return dec;
    } else return;
  },
  unlinkFiles(path) {
    let files = fs.readdirSync(path);

    let readFiles = function(filename, index) {
      fs.unlinkSync(path + filename);
    };

    return files.forEach(readFiles);
  },
  createRefreshTokenJsonFile(user, refreshToken) {
    console.log(user.email);
    let refreshTokenMapping = {};
    let jsonFilePath = "public/uploads/";

    if (!fs.existsSync(jsonFilePath)) fs.mkdirSync(jsonFilePath, 0777);

    jsonFilePath += "users/";

    if (!fs.existsSync(jsonFilePath)) fs.mkdirSync(jsonFilePath, 0777);

    jsonFilePath += user.user_id + "/";

    if (!fs.existsSync(jsonFilePath)) fs.mkdirSync(jsonFilePath, 0777);

    jsonFilePath += "refreshtoken.json";

    refreshTokenMapping[refreshToken] = user.email;

    return jsonfile.writeFileSync(jsonFilePath, refreshTokenMapping);
  },
  createCountriesJson(countries) {
    let jsonPath = "public/uploads/";

    if (!fs.existsSync(jsonPath)) fs.mkdirSync(jsonPath, 0777);

    jsonPath += "countries.json";

    return jsonfile.writeFileSync(jsonPath, countries);
  },
  getCountriesJson() {
    let jsonPath = "public/uploads/countries.json";

    if (fs.existsSync(jsonPath)) return jsonfile.readFileSync(jsonPath);
    else return;
  },
  _send(to, subject, email, isEmailTemplate = false) {
    let Q = require("q"),
      deffered = Q.defer(),
      promise = config.getConfig(),
      emailSendCallback = function(error, info) {
        if (error) {
          deffered.reject(error);
        }

        deffered.resolve({
          status: "success",
          message: "Message sent successfully."
        });
      },
      verifyCallBack = function(error, success, prefs, transporter) {
        if (error) {
          deffered.reject(error);
        }

        if (!isEmailTemplate) {
          let template = ` ${email}`;

          let mailOptions = {
            from: '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + ">",
            to: to,
            subject: subject,
            html: template
          };

          transporter.sendMail(mailOptions, (err, info) =>
            emailSendCallback(err, info)
          );
        } else {
          let template =
            config.email_header + email.template + config.email_footer;

          let mailOptions = {
            from: '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + ">",
            to: to,
            subject: subject,
            html: template
          };

          if (email.cc == "Y") {
            mailOptions.cc = prefs.adminEmail[0];
          }

          if (email.bcc == "Y") {
            mailOptions.bcc = prefs.adminEmail[0];
          }

          if (email.admin_only == "Y") {
            mailOptions.to = prefs.adminEmail[0];
          }

          transporter.sendMail(mailOptions, (err, info) =>
            emailSendCallback(err, info)
          );
        }
      },
      setEmail = function(prefs) {
        let poolConfig = {
            pool: true,
            host: prefs.smtpHost[0],
            port: prefs.smtpPort[0],
            secure: true, // use SSL
            auth: {
              user: prefs.smtpUser[0],
              pass: prefs.smtpPass[0]
            }
          },
          transporter = nodemailer.createTransport(poolConfig);

        transporter.verify((error, success) =>
          verifyCallBack(error, success, prefs, transporter)
        );
      };

    promise
      .then(prefs => setEmail(prefs))
      .catch(error => deffered.resolve(error));

    return deffered.promise;
  },
  _sendEmail(to, subject, email, isEmailTemplate = false) {
    let Q = require("q"),
      deffered = Q.defer(),
      promise = config.getConfig(),
      emailSendCallback = function(error, info) {
        if (error) {
          deffered.reject(error);
        }

        deffered.resolve({
          status: "success",
          message: "Message sent successfully."
        });
      },
      verifyCallBack = function(error, success, prefs, transporter) {
        if (error) {
          deffered.reject(error);
        }

        if (!isEmailTemplate) {
          let template = `${config.email_header_ticket} ${email} ${
            config.email_footer_ticket
          }`;

          let mailOptions = {
            from: '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + ">",
            to: to,
            subject: subject,
            html: template
          };

          transporter.sendMail(mailOptions, (err, info) =>
            emailSendCallback(err, info)
          );
        } else {
          let template =
            config.email_header_ticket +
            email.template +
            config.email_footer_ticket;

          let mailOptions = {
            from: '"' + prefs.fromName[0] + '" <' + prefs.fromEmail[0] + ">",
            to: to,
            subject: subject,
            html: template
          };

          if (email.cc == "Y") {
            mailOptions.cc = prefs.adminEmail[0];
          }

          if (email.bcc == "Y") {
            mailOptions.bcc = prefs.adminEmail[0];
          }

          if (email.admin_only == "Y") {
            mailOptions.to = prefs.adminEmail[0];
          }

          transporter.sendMail(mailOptions, (err, info) =>
            emailSendCallback(err, info)
          );
        }
      },
      setEmail = function(prefs) {
        let poolConfig = {
            pool: true,
            host: prefs.smtpHost[0],
            port: prefs.smtpPort[0],
            secure: true, // use SSL
            auth: {
              user: prefs.smtpUser[0],
              pass: prefs.smtpPass[0]
            }
          },
          transporter = nodemailer.createTransport(poolConfig);

        transporter.verify((error, success) =>
          verifyCallBack(error, success, prefs, transporter)
        );
      };

    promise
      .then(prefs => setEmail(prefs))
      .catch(error => deffered.resolve(error));

    return deffered.promise;
  },
  middleware(req, res, next) {
    let token = req.headers["authtoken"] || "";

    let method = req.method;

    token = token.replace(/^Bearer\s/, "");

    let verify_response = function(err, decoded) {
      console.log(err);
      if (!err) {
        req.decoded = decoded;
        next();
      } else if (err.name == "TokenExpiredError") {
        let originalDecoded = jwt.decode(token, { complete: true });

        req.decoded = originalDecoded.payload;

        let user = req.decoded;

        delete user["exp"];
        delete user["iat"];

        let jsonFilePath =
          "public/uploads/users/" +
          originalDecoded.payload.user_id +
          "/refreshtoken.json";

        let refreshToken = req.headers["refreshtoken"] || "";
        //console.log(refreshToken);
        let jsonObj;

        if (fs.existsSync(jsonFilePath))
          jsonObj = jsonfile.readFileSync(jsonFilePath);
        //console.log(jsonObj[refreshToken]);
        if (jsonObj[refreshToken] == originalDecoded.payload.email) {
          var refreshed = jwt.sign(user, config.secret, {
            expiresIn: 86400
          });
          res.setHeader("AuthToken", refreshed);
          res.setHeader("Authentication", true);
          next();
        } else {
          res.setHeader("Authentication", false);
          return res.json({
            status: false,
            message:
              "Your current session is invalid. Please login to continue.",
            statusCode: "TokenExpired"
          });
        }
      } else {
        res.setHeader("Authentication", false);
        return res.json({
          status: false,
          message: "Failed to authenticate token.",
          statusCode: "TokenInvalid"
        });
      }
    };

    if (method != "OPTIONS") {
      if (token) {
        jwt.verify(token, config.secret, verify_response);
      } else {
        res.setHeader("Authentication", false);
        return res.json({
          status: false,
          message: "No token provided.",
          statusCode: "TokenMissing"
        });
      }
    } else {
      return res.json({
        status: true,
        message: "Server preflight verification success."
      });
    }
  },
  uploadUserImages(user_details, profile_image, image_name) {
    let base_path = "public/uploads/";

    if (!fs.existsSync(base_path)) fs.mkdirSync(base_path);

    base_path += "users/";

    if (!fs.existsSync(base_path)) fs.mkdirSync(base_path);

    let upload_dir = user_details.user_id + "/";

    let upload_path = `${base_path}${upload_dir}`;

    if (!fs.existsSync(upload_path)) fs.mkdirSync(upload_path);

    upload_path += image_name;

    let base64Data = profile_image.split(",")[1];

    return fs.writeFileSync(upload_path, base64Data, "base64");
  },
  uploadPostImage(post_id, image, post_type) {
    let base_path = "public/uploads/";

    if (!fs.existsSync(base_path)) fs.mkdirSync(base_path);

    base_path = `${base_path}${post_type}/`;

    if (!fs.existsSync(base_path)) fs.mkdirSync(base_path);

    let image_name = `${post_id}.jpg`;

    let upload_path = `${base_path}${image_name}`;

    let base64Data = image.split(",")[1];

    fs.writeFileSync(upload_path, base64Data, "base64");

    return;
  },
  sendPush(token, data) {
    return new Promise((resolve, reject) => {
      let pushCallback = function(err, response) {
        if (err) reject(err);
        else resolve(response);
      };
      //data.title = data.title;
      //data.body = data.notification_type;

      data.sound = "default";
      var message = {
        to: token,
        collapse_key: "newage",
        data: {},
        notification: { title: 'New Message Received', body: data.message['message'] }
      };

      fcm.send(message, pushCallback);
    });
  },
  decodeBase64Image(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    var response = {};

    if (matches.length !== 3) {
      return new Error("Invalid input string");
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], "base64");

    return response;
  },
  sendWebPush(notification, subscription) {
    return new Promise(function(resolve, reject) {
      if (subscription) {
        webpush
          .sendNotification(
            JSON.parse(subscription),
            JSON.stringify(notification)
          )
          .then(result => {
            resolve(result);
          })
          .catch(error => {
            console.log("web-push", error);
            reject(error);
          });
      } else {
        reject("No subcription found!");
      }
    });
  },
  send_pushnotification: function (user_id, message, data) {
    if (user_id > 0) {
			functions.get('user_device_token_list', {user_id: user_id})
      .then(results => {
				if (results.length) {
					for (let key in results) {
						functions._send_pushnotification(results[key]['fcm_id'], results[key]['device'], message, data);
					}
				}
      })
      .catch(error => {
        console.log(error);
      })
    }
	},
	_send_pushnotification: function (device_token, device, message, data) {
		if (device_token != '') {
			var serverKey = 'AIzaSyC0PQfBjCnN0b3_Oc6dVoDJaC1fqbhxtWY';
			var fcm = new FCM(serverKey);

			if (device != 'ios') {
				data['body'] = message;
				data['sound'] = "default";
				data['icon'] = "logo_img";
			}
			var push_message = {
				to: device_token,
				data: data,
				priority: "high",

			};
			if (device == 'ios') {
				push_message['notification'] = {
					title: data.title,
					body: message,
					sound: "default",
					icon: "logo_img"
				};
			}
			//console.log( push_message );
			fcm.send(push_message)
				.then(function (response) {
						console.log("Successfully sent with response: ", response);
				}).catch(function (err) {
					console.error("Something has gone wrong!", err);
					console.error("device_token:  ", device_token);
				})
		} else {
			//	console.log("No device token");
		}
	},
};

module.exports = functions;
