let express = require("express"),
  router = express.Router(),
  userhandler = require("../handlers/userHandler"),
  functions = require("../helpers/functions"),
  mw = require("../helpers/middleware");

/* GET users listing. */
router.get("/", userhandler.index);
router.get("/content", userhandler.content);

//router.post('/authenticate', userhandler.authenticate);
router.post("/login", userhandler.login);

router.post("/register", userhandler.register);

// router.post('/reset_password', userhandler.reset_password);

// router.post('/forgot_password', userhandler.forgot_password);
router.post("/verify", userhandler.verifyemail);
router.post("/sendCode", userhandler.sendCode);
router.post("/checkFrgtVerification", userhandler.checkFrgtVerification);
router.post("/frgt_reset_password", userhandler.frgt_reset_password);
router.post("/getStates", userhandler.getStates);
router.post("/verify_code", userhandler.verify_code);
router.use(mw.authMiddleware);
router.post("/update_push_subscription", userhandler.updatePushObject);
router.post("/updateProfile", userhandler.updateProfile);
router.post("/updateGeneral", userhandler.updateGeneral);
router.post("/forgot_password", userhandler.forgot_password);
router.post("/reset_password", userhandler.reset_password);
router.get("/deleteAccount", userhandler.deleteAccount);
router.get("/getUserPoints", userhandler.getUserPoints);

// router.post('/auto_login', userhandler.auto_login);

// router.post('/create_team', userhandler.create_team);

// router.post('/players_list', userhandler.players_list);

// router.post('/change_password', userhandler.change_password);

// router.post('/team_list', userhandler.findUserId,userhandler.team_list);

// router.post('/sports_category_list', userhandler.sports_category_list);

// router.post('/team_profile', userhandler.team_profile);

module.exports = router;
