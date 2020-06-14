let express = require("express"),
  router = express.Router(),
  clienthandler = require("../handlers/clientHandler"),
  posthandler = require("../handlers/postsHandler"),
  functions = require("../helpers/functions");

  
/* GET users listing. */
router.get("/", clienthandler.index);

router.post("/login", clienthandler.login);

router.post("/socialmedia_login", clienthandler.socialmedia_login);

router.post("/register", clienthandler.register);

router.post("/socialmedia_register", clienthandler.socialmedia_register);

router.post("/forgot_password", clienthandler.forgot_password);

router.post("/verify_resetcode", clienthandler.verify_resetcode);

router.post("/reset_password", clienthandler.reset_password);

router.post("/verify_email", clienthandler.verify_email);

router.post("/create_token", clienthandler.create_token);



router.use(functions.middleware);

router.get("/profile_details", clienthandler.profile_details);

router.get("/states_list", clienthandler.states_list);

router.post("/edit_profile", clienthandler.edit_profile);

router.post("/upload_video", clienthandler.upload_video);

router.post("/video_list", clienthandler.video_list);

router.post("/video_details", clienthandler.video_details);

router.post("/video_image_list", clienthandler.video_image_list);

router.post("/album_details", clienthandler.album_details);

router.post("/get_comments", clienthandler.get_comments);

router.post("/add_comment", clienthandler.add_comment);

router.post("/contribute", clienthandler.contribute);

router.post("/my_earnings", clienthandler.my_earnings);

router.post("/change_password", clienthandler.change_password);

router.post("/notifications", clienthandler.notifications);

router.post("/react_comment", clienthandler.react_comment);

router.post("/one_to_onechat", posthandler.oneToOneChat);
router.post("/get_chat_details", posthandler.getChatDetails);

router.post("/get_group_list", posthandler.getGroupList);

router.post("/create_group", posthandler.createGroup);

router.post("/get_group_details", posthandler.getGroupDetails);

router.post("/get_home_feeds", posthandler.getHomeFeed);

router.post("/get_group_members", posthandler.getGroupMembers);

router.post("/joinGroupMembers", posthandler.joinGroupMembers);
router.post("/getUserDetails", posthandler.getUserDetails);
router.post("/userFollowUnfollow", posthandler.userFollowUnfollow);



/*router.post("/verify", userhandler.verifyemail);
router.post("/sendCode", userhandler.sendCode);
router.post("/checkFrgtVerification", userhandler.checkFrgtVerification);
router.post("/frgt_reset_password", userhandler.frgt_reset_password);
router.post("/getStates", userhandler.getStates);
router.post("/verify_code", userhandler.verify_code);
router.use(functions.middleware);
router.post("/updateProfile", userhandler.updateProfile);
router.post("/updateGeneral", userhandler.updateGeneral);
router.post("/forgot_password", userhandler.forgot_password);
router.post("/reset_password", userhandler.reset_password);*/


module.exports = router;
