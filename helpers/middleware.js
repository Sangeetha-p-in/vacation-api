
var jwt = require("jsonwebtoken");
var functions = require("../helpers/functions");
var config = require("../server/config");

const authMiddleware = (req, res, next)=> {
    let token = req.headers[ "authtoken" ] || "";
    
    let method = req.method;
    
    token = token.replace(/^Bearer\s/, "");
    
    console.log("here2",method)
    let verify_response = function (err, decoded) {
        if (!err) {
            req.decoded = decoded;
            
            functions.get("user_master", {id : req.decoded.id}).then((result)=>{
                const user = result[0]
                
                if(user.deleted_at != null) {
                    res.setHeader("Authorization", false);
                    return res.json({
                        status: false,
                        message:
                        "Your account is deleted "
                    });
                }
                else{
                    next();
                }
            })
            
        } else if (err.name == "TokenExpiredError") {
            let originalDecoded = jwt.decode(token, { complete: true });
            
            req.decoded = originalDecoded.payload;
            
            let user = req.decoded;
            
            delete user[ "exp" ];
            delete user[ "iat" ];
            
            let jsonFilePath =
            "public/uploads/users/" +
            originalDecoded.payload.user_id +
            "/refreshtoken.json";
            
            let refreshToken = req.headers[ "refreshtoken" ] || "";
            //console.log(refreshToken);
            let jsonObj;
            
            if (fs.existsSync(jsonFilePath))
            jsonObj = jsonfile.readFileSync(jsonFilePath);
            //console.log(jsonObj[refreshToken]);
            if (jsonObj[ refreshToken ] == originalDecoded.payload.email) {
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
    
    console.log("here2",method)
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
}
exports.authMiddleware = authMiddleware