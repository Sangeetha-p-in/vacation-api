var express = require("express");
var router = express.Router();
var indexHandler = require("../handlers/indexHandler");
var functions = require("../helpers/functions");
const mw = require("../helpers/middleware");

/* GET home page. */
router.get("/", function (req, res, next) {
  // res.send("Success");
  res.render('index', {title: "VacationMe Socket io"});
});

router.get("/categories", indexHandler.getCategories);
router.post("/config", functions.middleware, indexHandler.getConfig);
router.post(
  "/notifications",
  mw.authMiddleware,
  indexHandler.getUserNotification
);
router.post(
  "/notifications/read",
  mw.authMiddleware,
  indexHandler.readNotification
);
router.post(
  "/notification/delete",
  mw.authMiddleware,
  indexHandler.deleteNotification
);
router.post("/subscribe", indexHandler.subscribe);
router.post("/unsubscribe", indexHandler.unsubscribe);

module.exports = router;
