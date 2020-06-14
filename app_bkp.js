var express = require("express");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
require("dotenv").config();
var index = require("./routes/index");
var users = require("./routes/users");
var posts = require("./routes/posts");
var crones = require("./routes/crones");
var client = require("./routes/client");
var expressValidator = require('express-validator');

var app = express();
app.use(expressValidator());
app.disable("x-powered-by");

// Add headers
app.use(function(req, res, next) {
   var allowedOrigins = ['https://10.10.10.89:4401','http://10.10.10.89:4200', 'http://10.10.10.254', 'http://10.10.10.26:4200','http://10.10.10.70:4200', 'http://localhost:4200','http://demo.newagesme.com/7010','http://10.10.10.70:3000/users','https://newagesme.com:7010/users','https://newagesme.com/7011/users','https://newagesme.com', 'https://rajesh-apex:5881/', 'http://rajesh-apex:5880/', 'https://rajesh-apex:5881/', 'http://rajesh-apex:5880/' , 'https://rajesh-apex:4401/'];
  var origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) > -1) {
  // Website you wish to allow to connect
  // res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,cache-control,content-type,accept,authorization,x-access-token,x-refresh-token,AuthToken,RefreshToken,authtoken,refreshtoken,Authentication"
  );

  // Response headers you wish to allow
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Authentication,AuthToken,RefreshToken,Authorization"
  );
  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Pass to next layer of middleware
  next();
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", index);
app.use("/users", users);
app.use("/posts", posts);
app.use("/crones", crones);
app.use("/client", client);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
