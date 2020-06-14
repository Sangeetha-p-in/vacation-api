let express = require("express"),
  app = express(),
  moment = require("moment"),
  config = require("../server/config"),
  indexModel = require("../dao/indexDao"),
  fs = require("fs"),
  uniqid = require("uniqid"),
  userModel = require("../dao/userDao");

let indexHandler = {};

indexHandler.getCategories = (req, res, next) => {
  indexModel
    .getCategories()
    .then(response => {
      response.forEach(cat => {
        if (cat.active) delete cat.active;
        if (cat.created_at) delete cat.created_at;
      });
      res.json({ status: "success", result: response });
    })
    .catch(err => {
      res.status(403).json({ status: "fail", error: err });
    });
};

indexHandler.getConfig = (req, res, next) => {
  if (req.body.params) {
    indexModel
      .getConfig(req.body.params)
      .then(response => {
        if (response.length) {
          let params = req.body.params;
          let data = {};
          if (typeof params === "string") {
            data[params] = response[0].value;
          } else if (Array.isArray(params)) {
            for (var i = 0; i < response.length; i++) {
              for (var j = 0; j < params.length; j++) {
                if (response[i].field === params[j]) {
                  data[params[j]] = response[i].value;
                }
              }
            }
          }
          res.json({ status: true, result: data });
        } else {
          throw new Error("No config found!");
        }
      })
      .catch(error => {
        res.json({ status: "fail", error: error });
      });
  }
};

indexHandler.getUserNotification = (req, res, next) => {
  if (req.decoded.user_id) {
    let params = req.body;
    params.user_id = req.decoded.user_id;
    params.bw_day = req.body.bw_day 
    indexModel.getUserNotificationUnreadCount(params)
      .then(result => {
        res.count = result[0].count;
        return indexModel.getUserNotification(params);
      })
      .then(response => {
        if (response.length) {
          res.json({ status: "success", result: { count: res.count, data: response } });
        } else {
          res.json({ status: "success", result: [] });
        }
      })
      .catch(err => {
        console.log(err);
      });
  } else {
    res.json({
      status: "fail",
      error: new Error("Authorization failed!.")
    });
  }
};

indexHandler.readNotification = (req, res, next) => {
  if (req.decoded.user_id) {
    let params = req.body;
    params.user_id = req.decoded.user_id
    indexModel
      .readNotification(params)
      .then(response => {
        if (response.affectedRows) {
          res.json({ status: "success", function: "readNotification" });
        } else {
          res.json({
            status: "fail",
            function: "deleteNotification"
          });
        }
      });
  } else {
    res.json({
      status: "fail",
      error: new Error("Authorization failed!.")
    });
  }
};

indexHandler.deleteNotification = (req, res, next) => {
  if (req.decoded.user_id) {
    let params = req.body;
    params.user_id = req.decoded.user_id
    indexModel
      .deleteNotification(params)
      .then(response => {
        if (response.affectedRows) {
          res.json({ status: "success", function: "deleteNotification" });
        } else {
          res.json({
            status: "fail",
            function: "deleteNotification"
          });
        }
      });
  } else {
    res.json({
      status: "fail",
      error: new Error("Authorization failed!.")
    });
  }
};

indexHandler.subscribe = (req, res, next) => {
  if (req.body.email_id) {
    indexModel
      .subscribe({ email_id: req.body.email_id })
      .then(response => {
        if (response.affectedRows > 0) {
          res.json({
            status: true,
            result: "You are successfully subscribed to our newsletter."
          });
        }
      })
      .catch(error => {
        res.json({ status: false, error: error });
      });
  } else {
    res.json({ status: false, error: "No email id found!" });
  }
};

indexHandler.unsubscribe = (req, res, next) => {
  if (req.body.email_id) {
    indexModel
      .unsubscribe({ email_id: req.body.email_id })
      .then(response => {
        if (response.affectedRows > 0) {
          res.json({
            status: true,
            result: "Successfully unsubscribed from newsletter service"
          });
        } else {
          throw "Error while unsubscribe! Please try again.";
        }
      })
      .catch(error => {
        res.json({ status: false, error: error });
      });
  } else {
    res.json({ status: false, error: "No email id found!" });
  }
};

module.exports = indexHandler;
