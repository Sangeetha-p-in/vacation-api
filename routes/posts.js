let express = require("express"),
  router = express.Router(),
  posthandler = require("../handlers/postsHandler"),
  functions = require("../helpers/functions"),
  mw = require("../helpers/middleware");

router.post("/", posthandler.index);
router.post("/search", posthandler.search);
router.post("/getVideos", posthandler.getVideos);
router.post("/getPhotos", posthandler.getPhotos);
router.get("/recommendedVideos", posthandler.getRecommendedVideos);
router.post("/recommendedAlbums", posthandler.getRecommendedAlbums);
router.get("/video/:id", posthandler.getVideoPostDetails);
router.post("/logVideoView", posthandler.viewVideo ,posthandler.handleViewPointCount);
router.post("/logPhotoView", posthandler.viewPhoto , posthandler.handleViewPointCount);
router.post("/logAdView", posthandler.logAdView);
router.post("/getVideoComments", posthandler.getVideoComments);
router.post("/getPhotoComments", posthandler.getPhotoComments);
router.post("/getAlbums", posthandler.getAlbums);
router.post("/getAlbumListing",posthandler.getAlbumListing);
router.post("/getCount", posthandler.getCount)
router.post("/getImageAd", posthandler.getImageAd)
router.get("/ad_redirect", posthandler.ad_redirect)
router.get("/getWebsiteBanners",posthandler.getWebsiteBanners)

router.post('/getGroupsListing',posthandler.getGroupsListing);
router.post('/getGroupDetailsNew',posthandler.getGroupDetailsNew);
router.post("/getGroupMembersNew", posthandler.getGroupMembersNew);
router.post("/getHomeFeedNew", posthandler.getHomeFeedNew);
router.post("/getUserDetailsNew", posthandler.getUserDetailsNew);
router.post("/getUserDashbord", posthandler.getUserDashbord);
router.post("/getUserGroups", posthandler.getUserGroups);
router.post("/logSkip",posthandler.logSkip)
router.get("/getAdPosition", posthandler.getAdPosition);

// router.use(functions.middleware);
router.use(mw.authMiddleware);

router.post("/likeUnlikeComment", posthandler.likeorUnlikeComment);
router.post("/userPost", posthandler.userPost);
router.post("/getMyPosts", posthandler.getUserPosts);
router.post("/getCustomerPosts", posthandler.getCustomerPosts);
router.post("/deleteVideo/:id", posthandler.deleteVideo);
router.post("/deletePhoto/:id", posthandler.deletePhoto);
router.post("/getPostDetails", posthandler.getPostDetails);
router.post("/getCustomersForPush", posthandler.getCustomersForPush);
router.post("/createPost", posthandler.createPost);
router.post("/createPhotoPost", posthandler.createPhotoPost);
router.post("/contribute", posthandler.contribute, posthandler.addContributionCoin);
router.post("/contributetoalbum", posthandler.contributetoalbum,posthandler.addContributionCoin);
router.get("/contributions/:video_id", posthandler.getContributers);
router.post("/addVideoComment", posthandler.addVideoComment);
router.post("/addPhotoComment", posthandler.addPhotoComment);

router.post("/getHomeFeed", posthandler.getHomeFeed);
router.post("/createGroup", posthandler.createGroup);
router.post("/editGroup", posthandler.editGroup);

router.post("/getGroupList", posthandler.getGroupList);
router.post("/getGroupMembers", posthandler.getGroupMembers);
router.post("/getGroupDetails", posthandler.getGroupDetails);
router.post("/joinGroupMembers", posthandler.joinGroupMembers);
router.post("/userFollowUnfollow", posthandler.userFollowUnfollow);
router.post("/getChatList", posthandler.getChatList);
router.post("/getChatDetails", posthandler.getChatDetails);
router.post("/oneToOneChat", posthandler.oneToOneChat);
router.post("/followUsers", posthandler.followUsers);
router.post("/getUserDetails", posthandler.getUserDetails);
router.post("/getFollowList", posthandler.getFollowList);
router.post("/isThisVideoOwnerMyfollowing", posthandler.isThisVideoOwnerMyfollowing)
router.post("/isThisAlbumOwnerMyfollowing", posthandler.isThisAlbumOwnerMyfollowing)
router.post("/getUnreadChatNotification",posthandler.getUnreadChatNotification)
router.post("/getMyChatList",posthandler.getMyChatList)
router.post("/getChatGroupDetails",posthandler.getChatGroupDetails)
router.post("/getUserDetail",posthandler.getUserDetail)
router.post("/removeFromGroup",posthandler.removeFromGroup)
router.post("/setLastread",posthandler.setLastread)
router.post("/editComment",posthandler.edit_comment)
router.post("/deleteComment",posthandler.delete_comment)
router.post("/likePost",posthandler.logReaction, posthandler.updateItemReactionCount, posthandler.updateReactionPoints, posthandler.handleReactionNotification)
router.post("/getMyReaction",posthandler.getMyReaction)
router.post("/report",posthandler.report)
router.post("/getReportCategoryList",posthandler.getReportCategoryList)
router.post("/getGroupSubCount",posthandler.getGroupSubCount)
router.post("/getUserSubscribed",posthandler.getUserSubscribed)
router.post("/getMyPoints",posthandler.getMyPoints)
router.post("/getMyCoins",posthandler.getMyCoins)
router.post("/editVideoPost",posthandler.editVideoPost)
router.post("/editAlbum",posthandler.editAlbum)
router.post("/deleteAlbum",posthandler.deleteAlbum)

module.exports = router;
