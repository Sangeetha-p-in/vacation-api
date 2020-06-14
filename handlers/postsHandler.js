let express = require("express"),
  app = express(),
  moment = require("moment"),
  config = require("../server/config"),
  postModel = require("../dao/postsDao"),
  indexModel = require("../dao/indexDao"),
  user = require("../dao/userDao"),
  functions = require("../helpers/functions"),
  fs = require("fs"),
  uniqid = require("uniqid"),
  userModel = require("../dao/userDao");
  const requestIp = require('request-ip');

let stripe;

let handler = {
  index(req, res, next) {
    postModel
      .getPostCount(req.body)
      .then(result => {
        return result[ 0 ].count;
      })

      .then(postCount => {
        return Promise.all([ postCount, postModel.getPosts(req.body) ]);
      })

      .then(response => {
        res.status(200).json({
          status: "success",
          result: response[ 1 ],
          postCount: response[ 0 ]
        });
      })
      .catch(err => {
        console.log(err);
        res.status(403).json({
          status: "fail",
          error: err,
          errorcode: "serverError"
        });
      });
  },
  search(req, res, next) {
       const promise =  Promise.all([
          req.body.searchType == "videos" && postModel.getSearchVideos({ search: req.body.search , limit : req.body.limit , offset : req.body.offset  }) ||
          req.body.searchType == "photos" && postModel.getSearchPhotos({ search: req.body.search , limit : req.body.limit , offset : req.body.offset }) ||
          req.body.searchType == "people" && postModel.getUsers({ 
            search: req.body.search &&
            req.body.search.match(/\S+/g) || [],
            limit : req.body.limit , offset : req.body.offset  }) ||
          req.body.searchType == "groups" && postModel.getGroups({ 
            search: req.body.search && req.body.search.match(/\S+/g) || [],
             limit : req.body.limit ,
             offset : req.body.offset  })
        ]);

        promise.then(response => {
        res.status(200).json({
          searchType: req.body.searchType,
          result: response[ 0 ],
          status: "success"
        });
      })
      .catch(err => {
        console.log(err)
        res.status(403).json({
          status: "fail",
          error: err,
          errorcode: "serverError"
        });
      });
  },
  getVideos(req, res, next) {

    let trending = [], latest=[], most_viewed=[], count, response={} ;
    postModel
      .getVideoCount(req.body)
      .then(result => {
        return result && result[ 0 ] && result[ 0 ].count;
      })

      .then(postCount => {
        count = postCount;
        return  postModel.getCategorizedVideos(req.body,"trending");
      })

      .then(trendingResponse => {

        trending = trendingResponse;

        return  postModel.getCategorizedVideos(req.body,"most_viewed");

      })
      .then(mostviewedResponse=>{
         
        most_viewed = mostviewedResponse;

        return  postModel.getCategorizedVideos(req.body,"latest");
         
      })
      .then(latestResponse=>{

          latest = latestResponse;

          response = {
             
            trending : trending,
            most_viewed : most_viewed,
            latest : latest

          }

          res.status(200).json({
            status: "success",
            result: response,
            postCount: count,
          });
      })
     
      .catch(err => {
        console.log(err);
        res.status(403).json({
          status: "fail",
          error: err,
          errorcode: "serverError"
        });
      });
  },
  async getPhotos(req, res, next) {
    try {
      const photos = await postModel.getPhotos({ limit: req.body.limit, offset: req.body.offset })
      res.status(200).json({
        status: "success",
        result: photos,
      });
    }
    catch (err) {
      res.status(403).json({
        status: "fail",
        error: err,
        errorcode: "serverError"
      });
    }

  },
  userPost(req, res, next) {
    if (req.decoded.user_id) {
      if (!req.body.title)
        res
          .status(403)
          .json({ status: "fail", error: "Business name is required." });
      else if (req.body.is_image_uploaded == "N")
        res
          .status(403)
          .json({ status: "fail", error: "Banner image is required." });
      else if (!req.body.sub_title)
        res
          .status(403)
          .json({ status: "fail", error: "Subtitle is required." });
      else if (!req.body.post_location)
        res.status(403).json({ status: "fail", error: "Address is required." });
      else if (!req.body.business_industry)
        res
          .status(403)
          .json({ status: "fail", error: "Business industry is required." });
      else if (!req.body.description && req.body.post_type == "offer")
        res
          .status(403)
          .json({ status: "fail", error: "How to redeem is required." });
      else if (!req.body.description && req.body.post_type == "campaign")
        res
          .status(403)
          .json({ status: "fail", error: "Description is required." });
      else if (!req.body.target_industry_id)
        res
          .status(403)
          .json({ status: "fail", error: "Target industry is required." });
      else if (!req.body.sex)
        res
          .status(403)
          .json({ status: "fail", error: "Target gender is required." });
      else if (!req.body.from_age || !req.body.to_age)
        res
          .status(403)
          .json({ status: "fail", error: "Target age range is required." });
      else if (req.body.from_age >= req.body.to_age)
        res.status(403).json({
          status: "fail",
          error: "'From' age should be less than 'To' age."
        });
      else {
        let postDetails = req.body;

        let image = req.body.image;

        delete postDetails[ "image" ];

        postDetails.user_master_user_id = req.decoded.user_id;

        postDetails.created_time = moment().utc().format("YYYY-MM-DD HH:mm:ss");

        postModel
          .insertUserPosts(postDetails)
          .then(response => {
            if (response.insertId) {
              functions.uploadPostImage(
                response.insertId,
                image,
                postDetails.post_type
              );
              let message =
                postDetails.post_type == "offer"
                  ? "You have successfully posted the offer."
                  : "You have successfully posted the campaign";
              return Promise.all([
                response.insertId,
                message,
                config.getConfig()
              ]);
            } else throw "Database Error";
          })
          .then(postSuccess => {
            let filterOpts = {
              lat: postDetails.post_lat,
              lng: postDetails.post_lng,
              gender:
                postDetails.sex.indexOf(",") > -1
                  ? `'${postDetails.sex.split(",")[ 0 ]}', '${
                  postDetails.sex.split(",")[ 1 ]
                  }'`
                  : `'${postDetails.sex}'`,
              target_industry_id: postDetails.target_industry_id,
              from_age: postDetails.from_age,
              to_age: postDetails.to_age,
              radius: postSuccess[ 2 ].notificationRadius[ 0 ]
            };

            return Promise.all([
              postSuccess[ 0 ],
              postSuccess[ 1 ],
              userModel.getCustomersForPush(filterOpts)
            ]);
          })
          .then(resp => {
            let customerList = resp[ 2 ];

            if (customerList != undefined) {
              for (let i = 0; i < customerList.length; i++) {
                functions.sendPush(
                  customerList[ i ].device_token,
                  {
                    post_id: resp[ 0 ],
                    post_type: postDetails.post_type
                  },
                  {
                    title: "SWAYE",
                    body:
                      postDetails.post_type == "offer"
                        ? "New offer notification"
                        : "New campaign notification"
                  }
                );
              }
            }

            res
              .status(200)
              .json({ status: "success", post_id: resp[ 0 ], message: resp[ 1 ] });
          })
          .catch(err => {
            console.log(err);
            res
              .status(403)
              .json({ status: "fail", error: err, errorcode: "serverError" });
          });
      }
    } else
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
  },

  getMyPosts(req, res, next) {
    if (req.decoded.user_id) {
      postModel
        .getMyPostCount(
          req.decoded.user_id,
          req.body.post_type,
          req.body.search
        )
        .then(result => {
          return result[ 0 ].count;
        })

        .then(postCount => {
          return Promise.all([
            postCount,
            postModel.getPostByUserID(
              req.decoded.user_id,
              req.body.post_type,
              req.body.offset - 1,
              req.body.limit,
              req.body.search
            )
          ]);
        })

        .then(response => {
          res.status(200).json({
            status: "success",
            result: response[ 1 ],
            postCount: response[ 0 ]
          });
        })
        .catch(err => {
          console.log(err);
          res
            .status(403)
            .json({ status: "fail", error: err, errorcode: "serverError" });
        });
    } else
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
  },

  getCustomerPosts(req, res, next) {
    if (req.decoded.user_id && req.decoded.user_types_type_id == 2) {
      let configValues, user;

      config
        .getConfig()
        .then(conf => {
          configValues = conf;
        })
        .then(() => {
          return userModel.getCustomerDetails(req.decoded.user_id);
        })
        .then(customerDetails => {
          if (customerDetails) {
            user = customerDetails[ 0 ];

            user.radius = configValues.notificationRadius[ 0 ];
            user.period = configValues.postExpiry[ 0 ];

            if (user.gender && user.dob && user.industries_industry_id)
              return postModel.getPostForCustomer(
                user,
                req.body.post_type,
                true
              );
            else
              throw "Please update your profile to view the offers or campaigns";
          } else throw "User doesn't exist.";
        })
        .then(allPosts => {
          let totalRecords = allPosts ? allPosts.length : 0;
          return Promise.all([
            totalRecords,
            postModel.getPostForCustomer(
              user,
              req.body.post_type,
              false,
              req.body.offset - 1,
              req.body.limit
            )
          ]);
        })
        .then(posts => {
          res
            .status(200)
            .json({ status: "success", result: posts[ 1 ], postCount: posts[ 0 ] });
        })
        .catch(err => {
          console.log(err);
          res
            .status(403)
            .json({ status: "fail", error: err, errorcode: "serverError" });
        });
    } else
      res.status(403).json({
        status: false,
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
  },

  getPostDetails(req, res, next) {
    if (req.decoded.user_id) {
      postModel.postDetailsById(req.body.post_id).then(response => {
        res.status(200).json({ status: "success", result: response });
      });
    } else
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
  },

  getCustomersForPush(req, res, next) {
    let filterOpts = req.body;

    filterOpts.gender =
      filterOpts.gender.indexOf(",") > -1
        ? `'${filterOpts.gender.split(",")[ 0 ]}', '${
        filterOpts.gender.split(",")[ 1 ]
        }'`
        : `'${filterOpts.gender}'`;

    console.log(filterOpts);

    userModel.getCustomersForPush(filterOpts).then(response => {
      res.status(200).json({ status: "success", result: response });
    });
  },

  async createPost(req, res, next) {

    try {
      
      let category_id = [],category_string='',positions=[],position_string='';
      if (!req.body.title)
        res
          .status(403)
          .json({ status: "fail", error: "Video title is required." });
      else if (!req.body.description)
        res
          .status(403)
          .json({ status: "fail", error: "Video description is required." });
      else if (!req.body.category_id)
        res
          .status(403)
          .json({ status: "fail", error: "Video category is required." });
      else if (!req.body.video_url)
        res.status(403).json({ status: "fail", error: "Video url is required." });
      else {
        req.body.user_id = req.decoded.user_id;
        for(var i = 0; i<req.body.category_id.length; i++){
          category_id.push(req.body.category_id[i].category_id);
        }
        category_string = category_id.join();
        req.body.category_id = category_string;
  
       if(req.body.ad_position){
          for(var i = 0; i<req.body.ad_position.length; i++){
            positions.push(req.body.ad_position[i].position);
          }
          position_string = positions.join();
          req.body.ad_position = position_string;
       } 
  
        req.body.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");
  
        const createPostResult = await postModel
          .createUserPost(req.body)

        const point_confg = await functions.get("points_coins", {
  
              id : 2
    
        })

        const pointInsertData = {
          item_id : createPostResult.insertId,
          item_type : "video",
          point : point_confg[0].points,
          user_id : req.decoded.id,
          scenario_id : "1",
          ip_address : requestIp.getClientIp(req),
          file_id : createPostResult.insertId,
          file_type : "video"
          
        }

  
        const pointInsertResult = await functions.insert("point_master", pointInsertData)

        const userDetail = await functions.get("user_master", {
          id : req.decoded.user_id
        })

        await functions.update("user_master",{
          total_point : userDetail[0].point
        },{
          id: req.decoded.user_id,
        })
  
  
        if (createPostResult.insertId) {
          res.json({
            status: "success",
            result: "Successfully posted your video."
          });
        } else {
              res.status(403).json({ status: "fail", error: "Database error!" });
        }
      }
    }
    
    catch(err) {
      console.log(err)
      res.status(403).json({
        status: "fail",
        error: err,
        errorcode: "serverError"
      });
    }
    
  },
  
  async createPhotoPost(req, res, next) {
    
    try {

      let category_id = [],category_string='';
      if (!req.body.title)
        res
          .status(403)
          .json({ status: "fail", error: "Photo title is required." });
      else if (!req.body.description)
        res
          .status(403)
          .json({ status: "fail", error: "Photo descroption is required." });
      else if (!req.body.category_id)
        res
          .status(403)
          .json({ status: "fail", error: "Photo category is required." });
      else if (!req.body.image_url)
        res.status(403).json({ status: "fail", error: "Photo url is required." });
      else if (!req.body.s3key)
        res.status(403).json({ status: "fail", error: "Photo s3 key is required." });
      else {
        req.body.user_id = req.decoded.user_id;
        for(var i = 0; i<req.body.category_id.length; i++){
          category_id.push(req.body.category_id[i].category_id);
        }
        category_string = category_id.join();
        req.body.category_id = category_string;
        req.body.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");

        const createAlbumResult = await postModel.createAlbum(req.body);
          
        if (createAlbumResult.album_id) {
            await postModel.createUserImagePost(createAlbumResult);
        } 
        else {
          throw ("No album found.")  
        } 

        const point_confg = await functions.get("points_coins", {
  
              id : 2
    
        })

        const pointInsertData = {
          item_id : createAlbumResult.album_id,
          item_type : "album",
          point : point_confg[0].points,
          user_id : req.decoded.id,
          scenario_id : "1",
          ip_address : requestIp.getClientIp(req),
          file_id : createAlbumResult.album_id,
          file_type : "album"
          
        }
  
      const pointInsertResult = await functions.insert("point_master", pointInsertData)
  
      const response = { status: "success", result: "Successfully created your album." };
      
      res.json(response);

      }
      
    }
    
    catch(err) {
      
      res.json({ status: "fail", message: err });

    }

  },

  createGroup(req, res, next) {
    if (!req.body.group_name)
      res
        .status(403)
        .json({ status: "fail", error: "group name is required." });
    else if (!req.body.description)
      res
        .status(403)
        .json({ status: "fail", error: "group description is required." });
    else if (!req.body.image)
      res
        .status(403)
        .json({ status: "fail", error: "image is required." });
    else {
      req.body.user_id = req.decoded.user_id;
      req.body.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");
      postModel.createGroup(req.body)
        .then(group => {

          functions.insert('group_members', {
            group_id: group.group_id,
            user_id: group.user_id,
            created_at: group.created_at,
            is_admin: 'Y'
          });

          const response = { status: true, message: "Successfully created your group.", result: group };
          res.json(response);
        })
        .catch(err => {
          res.json({ status: false, message: err });
        });
    }
    // if (!req.body.group_name)
    //   res
    //     .status(403)
    //     .json({ status: "fail", error: "group name is required." });
    // else if (!req.body.description)
    //   res
    //     .status(403)
    //     .json({ status: "fail", error: "group description is required." });
    // else if (!req.body.image)
    //   res
    //     .status(403)
    //     .json({ status: "fail", error: "image is required." });
    // // else if (!req.body.image_url)
    // //   res.status(403).json({ status: "fail", error: "image url is required." });
    // else {
    //   req.body.user_id = req.decoded.user_id;
    //   req.body.created_at = moment().utc().format("YYYY-MM-DD HH:mm:ss");
    //   postModel.createGroup(req.body).then(result => {
    //     if (result.group_id) {
    //       return postModel.createUserImagePost(result);
    //     } else throw ("No group found.")
    //   })
    //     .then(result => {
    //       const response = { status: "success", result: "Successfully created your group." };
    //       res.json(response);
    //     })
    //     .catch(err => {
    //       console.log("Image insert error", err);
    //       res.json({ status: "fail", message: err });
    //     })
    // }
  },
  async editGroup(req, res, next) {
    if (!req.body.group_id) {
      res.status(403)
        .json({ status: "fail", error: "group id is required." });
    }
    else {
      let upData = {}
      if (req.body.group_name) {
        upData.group_name = req.body.group_name
      }
      if (req.body.description) {
        upData.description = req.body.description
      }
      if (req.body.image) {
        upData.image = req.body.image
      }
      console.log('upData', upData)
      const result = await functions.update('group_master', upData, { group_id: req.body.group_id })
      res.json({ status: true, result });
    }
  },
  getAlbumListing(req,res,next){

    let latest = [],most_viewed = [],trending = [], response = {};

    postModel.getCategorizedPhotos(req.body,"trending")
    .then(trendingResponse=>{
    
      trending = trendingResponse;
      return postModel.getCategorizedPhotos(req.body,"most_viewed");
   
    })
    .then(mostviewedResponse=>{
     
      most_viewed = mostviewedResponse;
      return postModel.getCategorizedPhotos(req.body,"latest");

    })
    .then(latestResponse=>{
    
       latest = latestResponse;

       response = {
          trending:trending,
          most_viewed: most_viewed,
          latest:latest
       }

       console.log("response",response);

       res.json({
        status: true,
        result: {
          albums: response
         
        },
        message: 'Success'
      });

    })
    .catch(err => {
      
      res.json({
        status: false,
        result: "Something went wrong!",
        message: "Failed"
      })
    });
  },
  getAlbums(req, res, next) {

    let albumObj = {}
   
    postModel.getAlbums(req.body)
      .then(result => {
        albumObj = result;
        return functions.get("general_config",{
          field:"advertisement_radius"
        })
      })
      .then((result)=>{
        if (req.body.album_id) {
          
          var category = albumObj.albums[0].category_id.split(',').map(function(item) {
            return parseInt(item, 10);
         });
          return Promise.all([ albumObj.albums, 
            postModel.getRandomAds({limit:1,category_id:category,distance:result[0].value}) 
          
          ]);
        } else {
          return Promise.all([ albumObj.albums ]);
        }
      })
      .then(result => {
        console.log(result);
        res.json({
          status: true,
          result: {
            albums: result[ 0 ],
            ads: result[ 1 ] || []
          },
          message: 'Success'
        });
      })
      .catch(err => {
        console.log("ERROR GET ALBUM", err);
        res.json({
          status: false,
          result: "Something went wrong!",
          message: "Failed"
        })
      });
  },

  getUserPosts(req, res, next) {
    const body = req.body;
    if (req.decoded.user_id) {
      body[ "user_id" ] = req.decoded.user_id;
      postModel
        .getUserPostsCount(body)
        .then(result => {
          return result[ 0 ].count;
        })

        .then(postCount => {
          return Promise.all([ postCount, postModel.getUserPosts(body) ]);
        })

        .then(response => {
          res.status(200).json({
            status: "success",
            result: response[ 1 ],
            postCount: response[ 0 ]
          });
        })
        .catch(err => {
          res.status(403).json({
            status: "fail",
            error: err,
            errorcode: "serverError"
          });
        });
    } else
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
  },

  deleteVideo(req, res, next) {
    if (req.params.id) {
      postModel.deleteVideo(req.params.id)
        .then(result => {
          res.status(200).json({
            status: "success",
            result: {}
          });
        })
        .catch(err => {
          res.status(403).json({
            status: "fail",
            error: error,
            errorcode: "serverError"
          });
        });
    } else {
      res.status(403).json({
        status: "fail",
        error: "missing parameter!",
        errorcode: "serverError"
      });
    }
  },

  deletePhoto(req, res, next) {
    if (req.params.id) {
      postModel.deletePhoto(req.params.id)
        .then((result) => postModel.getAlbumDetailsByImage(req.params.id))
        .then(result => {
          res.status(200).json({
            status: "success",
            result: result[ 0 ]
          });
        })
        .catch(err => {
          res.status(403).json({
            status: "fail",
            error: error,
            errorcode: "serverError"
          });
        });
    } else {
      res.status(403).json({
        status: "fail",
        error: "missing parameter!",
        errorcode: "serverError"
      });
    }
  },

  getVideoPostDetails(req, res, next) {
    if (req.params.id) {
      postModel
        .getPostDetails(req.params.id)
        .then(details => {
          req.details = details;
         
          var positions = details[0].positions.split(',').map(function(item) {
            return parseInt(item, 10);
        });
        var category = details[0].category_id.split(',').map(function(item) {
          return parseInt(item, 10);
        });
        req.details[0].positions = positions;
        req.details[0].category = category

      }).then(()=>{
      
        return functions.get("general_config",{
          field:"advertisement_radius"
        })
      })
        .then((response)=>{
          const { country_code, lat, lng } = req.query
          const positions = req.details[0].positions
          const category = req.details[0].category
          return  postModel.getRandomAds({
            limit : positions.length,
            category_id:category,
            country_code,
            user_lat : lat,
            user_lng : lng, 
            distance:response[0].value
          });
        })
        .then(response => {
          if (req.details.length) {
            res.status(200).json({
              status: "success",
              result: req.details[ 0 ],
              ads: response.length ? response : []
            });
          } else {
            res.status(200).json({
              status: "success",
              result: {},
              ads: []
            });
          }
        })
        .catch(error => {
          console.log(error)
          res.status(403).json({
            status: "fail",
            error: error,
            errorcode: "serverError"
          });
        });
    } else {
      res.status(403).json({
        status: "fail",
        error: "missing parameter!",
        errorcode: "serverError"
      });
    }
  },

  viewVideo(req, res, next) {
    if (req.body.video_id && (req.body.user_id || req.body.ip_address)) {
      postModel
        .checkTodayUniqueView(
          req.body.video_id,
          req.body.user_id,
          req.body.ip_address
        )
        .then(result => {
          console.log(result)
          return result[ 0 ].count;
        })
        .then(count => {
          let u;
          u = (count <= 1 ? "Y" : "N");

          req.processed = {
              unique_view : u
          }

          return postModel.logVideoView(
            req.body.video_id,
            req.body.user_id,
            req.body.ip_address,
            u
          );
        })
        .then(response => {
          if (response.affectedRows > 0) {
            return postModel.getUniqueVideoCount(req.body.video_id);
          }
        })
        .then(result => {
          return postModel.updateUniqueViewCount(
            req.body.video_id,
            result[ 0 ].view_count
          );
        })
        .then(result => {
          if (result.affectedRows > 0) {
            res.status(200).json({
              status: "success"
            });
            next()
          }
        })
        .catch(err => {
          res.status(403).json({
            status: "fail",
            error: err,
            errorcode: "serverError"
          });
        });
    } else {
      res.status(403).json({
        status: "fail",
        error: "missing parameter!",
        errorcode: "serverError"
      });
    }
  },

  async handleViewPointCount(req,res,next) {
        try {
            const user_id = req.body.user_id
          if(req.body.user_id && req.processed && req.processed.unique_view == "Y") {
            
              const pointLogResult = await functions.get("user_point_log", {
                user_id,
                action_type:'post_view'
              })
      
              if(pointLogResult.length >0 ) {
      
                if(pointLogResult && pointLogResult[0].count==99){
      
                  const point_confg = await functions.get("points_coins", {
      
                    id : 6
      
                  })
      
      
                  await functions.insert("point_master", {
      
                      item_type: "ad_view",
                      point : point_confg[0].points,
                      user_id,
                      scenario_id:"6",
                      ip_address : requestIp.getClientIp(req),                  
      
                  })
      
                  await functions.update("user_point_log", {
                    count : 0
                  }, {
                    user_id
                  })
      
                }
                else
                {
      
                  await functions.update("user_point_log", {
                    count : pointLogResult[0].count + 1
                  }, {
                    user_id
                  })
      
                }
            }
            else{
      
                await functions.insert("user_point_log", {
                  count : 1,
                  user_id,
                  action_type:'post_view'
                })
      
            }
          }
          }

        catch(err) {
          console.log(err)
          res.json({
            err,
            status : false
          })
        }


  },

  viewPhoto(req, res, next) {
    if (req.body.photo_id && (req.body.user_id || req.body.ip_address)) {
      postModel
        .checkTodayUniquePhotoView(
          req.body.photo_id,
          req.body.user_id,
          req.body.ip_address
        )
        .then(result => {
          return result[ 0 ].count;
        })
        .then(count => {
          let u;
          u = (count <= 1 ? "Y" : "N");

          req.processed = {
              unique_view : u
          }
          
          return postModel.logPhotoView(
            req.body.photo_id,
            req.body.user_id,
            req.body.ip_address,
            req.body.album_id,
            u
          );
        })
        .then(response => {
          if (response.affectedRows > 0) {
            return postModel.getUniquePhotoCount(req.body.photo_id);
          }
        })
        .then(result => {
          return postModel.updateUniquePhotoViewCount(
            req.body.photo_id,
            result[ 0 ].view_count
          );
        })
        .then(result => {
          if (result.affectedRows > 0) {
            next();            
            res.status(200).json({
              status: "success"
            });
          }
        })
        .catch(err => {
          res.status(403).json({
            status: "fail",
            error: err,
            errorcode: "serverError"
          });
        });
    } else {
      res.status(403).json({
        status: "fail",
        error: "missing parameter!",
        errorcode: "serverError"
      });
    }
  },

  async logAdView(req, res, next) {

    try {
      
          if (req.body.ad_id && req.body.ip_address) {
      
                const logAdViewResult = await postModel.logAdView({
                    advertisement_id: req.body.ad_id,
                    user_id: req.body.user_id || null,
                    file_id: req.body.file_id,
                    file_type: req.body.file_type,
                    ip_address: req.body.ip_address,
                    created_at: new Date(),
                    action_type: req.body.action_type
                  })
                  if (logAdViewResult.affectedRows) {
      
                    if(req.body.action_type=='view'){
                      
      
                    await postModel.updateAdViewCount(req.body.ad_id);
 
                    let fileOwner
                    
                    if(req.body.file_type === "video" ) {
                      
                      const videoDetail = await functions.get("video_master", {
                        id: req.body.file_id,
                      })
                      
                      fileOwner = videoDetail[0].user_id
                      
                    }
                    
                    else if(req.body.file_type === "album") {
                      
                      const albumDetail = await functions.get("album_master", {
                        id: req.body.file_id,
                      })
                      
                      fileOwner = albumDetail[0].user_id
                      
                    }

                    const coin_confg = await functions.get("points_coins", {
                      
                      id : 8 
                      
                    })
                    
                    const coinInsertData = {
                      item_id : req.body.ad_id,
                      item_type : "ad_view",
                      coin : coin_confg[0].points,
                      user_id : fileOwner,
                      scenario_id : 8,
                      ip_address : requestIp.getClientIp(req),
                      file_id: req.body.file_id,
                      file_type: req.body.file_type
                      
                    }
                    
                    // const coins_got = await postModel.getTodayCoin(coinInsertData)

                    // if(coins_got.length < 2 ){

                          // await functions.insert("coin_master", coinInsertData)
                      
                    // }

                    await functions.insert("coin_master", coinInsertData)
                                                            
                  }

                  else{

                    await postModel.updateAdClickCount(req.body.ad_id);
                                        
                    let fileOwner
                    
                    if(req.body.file_type === "video" ) {
                      
                      const videoDetail = await functions.get("video_master", {
                        id: req.body.file_id,
                      })
                      
                      fileOwner = videoDetail[0].user_id
                      
                    }
                    
                    else if(req.body.file_type === "album") {
                      
                      const albumDetail = functions.get("album_master", {
                        id: req.body.file_id,
                      })
                      
                      fileOwner = albumDetail[0].user_id
                      
                    }
                    
                    const coin_confg = await functions.get("points_coins", {
                      
                      id : 9  
                      
                    })
                    
                    const coinInsertData = {

                      item_id : req.body.ad_id,
                      item_type : "ad_click",
                      coin : coin_confg[0].points,
                      user_id : fileOwner,
                      scenario_id : 8,
                      ip_address : requestIp.getClientIp(req),
                      file_id: req.body.file_id,
                      file_type: req.body.file_type
                      
                    }
                    
                    // const coins_got = await postModel.getTodayCoin(coinInsertData)

                    // if(coins_got.length < 2 ){

                      // await functions.insert("coin_master", coinInsertData)

                    // }

                    await functions.insert("coin_master", coinInsertData)
                    
                    const point_confg = await functions.get("points_coins", {
                      
                      id : 5 
                      
                    })

                    const pointInsertData = {
                      item_type : "ad_click",
                      point : point_confg[0].points,
                      user_id : req.body.user_id,
                      scenario_id : 5,
                      ip_address : requestIp.getClientIp(req)
                      
                    }
                    
                    
                    await functions.insert("point_master", pointInsertData)
                  
                  }
                  
                  res.json({
                    status: "success",
                    function: "logAdView"
                  });
      
                } 
                
                else {
      
                      throw "Error while log ad view!";
                  
                }
              
              }
      
              else {
        
                res.json({
                  status: false,
                  error: "Missing reqired parameter"
                });
      
              }

    }

    catch(err) {
      console.log(err)
        res.json({
          status: false,
          err
        });

    }
  },

  getAdPosition(req,res,next){
    postModel
    .getAdPosition()
    .then(response => {
      res.status(200).json({
        status: "success",
        result: response
      });
    })
    .catch(err => {
      res.status(403).json({
        status: "fail",
        error: err,
        errorcode: "serverError"
      });
    });
  },

  getRecommendedVideos(req, res, next) {
    postModel
      .getRecommendedVideos(req.query)
      .then(response => {
        res.status(200).json({
          status: "success",
          result: response
        });
      })
      .catch(err => {
        res.status(403).json({
          status: "fail",
          error: err,
          errorcode: "serverError"
        });
      });
  },
  getRecommendedAlbums(req, res, next) {
    postModel
      .getRecommendedAlbums({
        limit: req.body.limit,
        offset: req.body.offset
      })
      .then(response => {
        res.status(200).json({
          status: "success",
          result: response
        });
      })
      .catch(err => {
        res.status(403).json({
          status: "fail",
          error: err,
          errorcode: "serverError"
        });
      });
  },
  contribute(req, res, next) {
    let errors;
    let chargeObj;
    let videoOwner;
    let loginUser;
    let stripe;
    let isNewStripeUser;
    if (!req.body.video_id) errors[ "video" ] = "Video source not found";
    if (!req.body.name) errors[ "name" ] = "Name is required.";
    if (!req.body.amount) errors[ "amount" ] = "Amount is required.";
    if (!req.body.card_token) errors[ "card" ] = "No card details found";
    if (!errors) {
      functions
        .get("general_config", { field: "stripe_secret" })
        .then(response => {
          if (response.length) {
            stripe = require("stripe")(response[ 0 ].value);
            return functions.get("user_master", { id: req.decoded.user_id });
          } else {
            throw "Stripe Authentication Failed!";
          }
        })
        .then(response => {
          if (response.length) {
            loginUser = response[ 0 ];
            if (loginUser.stripe_id) {
              isNewStripeUser = false;
              return stripe.customers.retrieve(loginUser.stripe_id);
            } else {
              isNewStripeUser = true;
              return stripe.customers.create({ email: response[ 0 ].email });
            }
          } else {
            throw "No User found!";
          }
        })
        .then(function (customer) {
          if (isNewStripeUser) {
            functions.update('user_master', { stripe_id: customer.id },
              { id: req.decoded.user_id }).then(() => { });
          }
          return stripe.customers.createSource(customer.id, {
            source: req.body.card_token,
            metadata: {
              user_id: req.decoded.user_id
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

          return Promise.all([
            charge,
            functions.insert("video_earnings", {
              user_id: req.decoded.user_id,
              video_id: req.body.video_id,
              contributer_name: req.body.name,
              contributer_email: loginUser.email,
              amount: req.body.amount,
              note: req.body.note,
              created_at: new Date(charge.created),
              charge_object: JSON.stringify(charge)
            })
          ]);
        })
        .then(response => {
          if (response[ 1 ].affectedRows) {
            functions.get("video_master", { id: req.body.video_id })
            .then(response => {
                if (response.length) {
                  const t = response[ 0 ].total_earning
                    ? parseFloat(response[ 0 ].total_earning) +
                    parseFloat(req.body.amount)
                    : parseFloat(req.body.amount);
                  console.log("total_earning", t);
                  if (t >= 1) {
                      functions.update(
                          "video_master",
                          { total_earning: t },
                          { id: req.body.video_id }
                        )
                        .then(s => {
                          console.log("earning : db updated");
                        })
                        .catch(error => {
                          console.log("error", error);
                        });
                  }
                  return functions.get("user_master", {
                    id: response[ 0 ].user_id
                  });
                }
              })
              .then(response => {
                if (response.length) {
                  videoOwner = response[ 0 ];
                  return functions.get("general_emails", {
                    name: "contributer_successful_contribution",
                    status: "Y"
                  });
                }
              })
              .then(response => {
                if (response.length) {
                  let emailSubject = response[ 0 ].email_subject;
                  let emailContent = response[ 0 ].email_template;
                  emailContent = emailContent.replace(
                    new RegExp("#NAME#", "g"),
                    `${loginUser.first_name} ${loginUser.last_name}`
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#VIDEO_ID#", "g"),
                    req.body.video_id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#AMOUNT#", "g"),
                    req.body.amount
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#DATE#", "g"),
                    new Date(chargeObj.created)
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#TRAN_ID#", "g"),
                    chargeObj.id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#METHOD#", "g"),
                    chargeObj.source.object
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#STATUS#", "g"),
                    chargeObj.paid ? "PAID" : "DUE"
                  );
                  const email = { template: emailContent };
                  functions
                    ._send(loginUser.email, emailSubject, email, true)
                    .then(s => {
                      console.log("email sent to contributer");
                    })
                    .catch(error => {
                      console.log("email not sent to contributer", error);
                    });
                  return functions.get("general_emails", {
                    name: "video_owner_successful_contribution",
                    status: "Y"
                  });
                }
              })
              .then(response => {
                let emailSubject = response[ 0 ].email_subject;
                let emailContent = response[ 0 ].email_template;
                emailContent = emailContent.replace(
                  new RegExp("#NAME#", "g"),
                  `${videoOwner.first_name} ${videoOwner.last_name}`
                );
                emailContent = emailContent.replace(
                  new RegExp("#VIDEO_ID#", "g"),
                  req.body.video_id
                );
                emailContent = emailContent.replace(
                  new RegExp("#AMOUNT#", "g"),
                  req.body.amount
                );
                emailContent = emailContent.replace(
                  new RegExp("#CONTRIBUTER_NAME#", "g"),
                  `${loginUser.first_name} ${loginUser.last_name}`
                );
                emailContent = emailContent.replace(
                  new RegExp("#DATE#", "g"),
                  new Date(chargeObj.created)
                );
                const email = { template: emailContent };
                functions
                  ._send(videoOwner.email, emailSubject, email, true)
                  .then(s => {
                    console.log("email sent to video owner");
                  })
                  .catch(error => {
                    console.log("email not sent to video owner", error);
                  });
                return functions.get("general_emails", {
                  name: "admin_successful_contribution",
                  status: "Y"
                });
              })
              .then(response => {
                if (response.length) {
                  let emailSubject = response[ 0 ].email_subject;
                  let emailContent = response[ 0 ].email_template;
                  emailContent = emailContent.replace(
                    new RegExp("#VIDEO_ID#", "g"),
                    req.body.video_id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#AMOUNT#", "g"),
                    req.body.amount
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#DATE#", "g"),
                    new Date(chargeObj.created)
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#TRAN_ID#", "g"),
                    chargeObj.id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#METHOD#", "g"),
                    chargeObj.source.object
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#STATUS#", "g"),
                    chargeObj.paid ? "PAID" : "DUE"
                  );
                  const email = { template: emailContent, admin_only: "Y" };
                  functions
                    ._send("", emailSubject, email, true)
                    .then(s => {
                      console.log("email sent to admin");
                    })
                    .catch(error => {
                      console.log("email not sent to admin", error);
                    });
                }
              })
              .catch(error => {
                console.log("Error: ", error);
              });
            res.json({
              status: "success",
              result: {
                message: response[ 0 ].outcome.seller_message,
                paid: response[ 0 ].paid
              }
            });
            next();
          }
        })
        .catch(function (err) {
          res.json({ status: "fail", errors: err });
        });
    } else {
      console.log(errors)
      res.json({
        status: "fail",
        errors: errors
      });
    }
  },
  addContributionCoin(req,res,next){
          let total_amount = req.body.amount;
          let coinConvertAmount = total_amount - ((2.9/100)*total_amount + .3);
          let coinValue;
          functions.get("coin_value")
          .then(response => {
            coinValue = response[0].value;
            let coin = parseInt(coinConvertAmount/coinValue);
            functions.insert("coin_master", {
              item_id: 0,
              item_type: "contribution",
              user_id: req.decoded.user_id,
              coin:coin,
              scenario_id:10,
              file_type: (req.body.video_id != undefined)?"video":"album",
              file_id: (req.body.video_id != undefined)?req.body.video_id:req.body.album_id

            })
          })
          
  },
  contributetoalbum(req, res, next) {
    let errors;
    let chargeObj;
    let videoOwner;
    let loginUser;
    let stripe;
    let isNewStripeUser;
    if (!req.body.album_id) errors[ "video" ] = "Album source not found";
    if (!req.body.name) errors[ "name" ] = "Name is required.";
    if (!req.body.amount) errors[ "amount" ] = "Amount is required.";
    if (!req.body.card_token) errors[ "card" ] = "No card details found";
    if (!errors) {
      functions
        .get("general_config", { field: "stripe_secret" })
        .then(response => {
          if (response.length) {
            stripe = require("stripe")(response[ 0 ].value);
            return functions.get("user_master", { id: req.decoded.user_id });
          } else {
            throw "Stripe Authentication Failed!";
          }
        })
        .then(response => {
          if (response.length) {
            loginUser = response[ 0 ];
            if (loginUser.stripe_id) {
              isNewStripeUser = false;
              return stripe.customers.retrieve(loginUser.stripe_id);
            } else {
              isNewStripeUser = true;
              return stripe.customers.create({ email: response[ 0 ].email });
            }
          } else {
            throw "No User found!";
          }
        })
        .then(function (customer) {
          if (isNewStripeUser) {
            functions.update('user_master', { stripe_id: customer.id },
              { id: req.decoded.user_id }).then(() => { });
          }
          return stripe.customers.createSource(customer.id, {
            source: req.body.card_token,
            metadata: {
              user_id: req.decoded.user_id
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
          return Promise.all([
            charge,
            functions.insert("album_earnings", {
              user_id: req.decoded.user_id,
              album_id: req.body.album_id,
              contributer_name: req.body.name,
              contributer_email: loginUser.email,
              amount: req.body.amount,
              note: req.body.note,
              created_at: new Date(charge.created),
              charge_object: JSON.stringify(charge)
            })
          ]);
        })
        .then(response => {
          if (response[ 1 ].affectedRows) {
            functions
              .get("album_master", { id: req.body.album_id })
              .then(response => {
                if (response.length) {
                  const t = response[ 0 ].total_earning
                    ? parseFloat(response[ 0 ].total_earning) +
                    parseFloat(req.body.amount)
                    : parseFloat(req.body.amount);
                  console.log("total_earning", t);
                  if (t >= 1) {
                    functions
                      .update(
                        "album_master",
                        { total_earning: t },
                        { id: req.body.album_id }
                      )
                      .then(s => {
                        console.log("earning : db updated");
                      })
                      .catch(error => {
                        console.log("error", error);
                      });
                  }
                  return functions.get("user_master", {
                    id: response[ 0 ].user_id
                  });
                }
              })
              .then(response => {
                if (response.length) {
                  videoOwner = response[ 0 ];
                  return functions.get("general_emails", {
                    name: "contributer_successful_contribution",
                    status: "Y"
                  });
                }
              })
              .then(response => {
                if (response.length) {
                  let emailSubject = response[ 0 ].email_subject;
                  let emailContent = response[ 0 ].email_template;
                  emailContent = emailContent.replace(
                    new RegExp("#NAME#", "g"),
                    `${loginUser.first_name} ${loginUser.last_name}`
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#VIDEO_ID#", "g"),
                    req.body.album_id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#AMOUNT#", "g"),
                    req.body.amount
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#DATE#", "g"),
                    new Date(chargeObj.created)
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#TRAN_ID#", "g"),
                    chargeObj.id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#METHOD#", "g"),
                    chargeObj.source.object
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#STATUS#", "g"),
                    chargeObj.paid ? "PAID" : "DUE"
                  );
                  const email = { template: emailContent };
                  functions
                    ._send(loginUser.email, emailSubject, email, true)
                    .then(s => {
                      console.log("email sent to contributer");
                    })
                    .catch(error => {
                      console.log("email not sent to contributer", error);
                    });
                  return functions.get("general_emails", {
                    name: "video_owner_successful_contribution",
                    status: "Y"
                  });
                }
              })
              .then(response => {
                let emailSubject = response[ 0 ].email_subject;
                let emailContent = response[ 0 ].email_template;
                emailContent = emailContent.replace(
                  new RegExp("#NAME#", "g"),
                  `${videoOwner.first_name} ${videoOwner.last_name}`
                );
                emailContent = emailContent.replace(
                  new RegExp("#VIDEO_ID#", "g"),
                  req.body.album_id
                );
                emailContent = emailContent.replace(
                  new RegExp("#AMOUNT#", "g"),
                  req.body.amount
                );
                emailContent = emailContent.replace(
                  new RegExp("#CONTRIBUTER_NAME#", "g"),
                  `${loginUser.first_name} ${loginUser.last_name}`
                );
                emailContent = emailContent.replace(
                  new RegExp("#DATE#", "g"),
                  new Date(chargeObj.created)
                );
                const email = { template: emailContent };
                functions
                  ._send(videoOwner.email, emailSubject, email, true)
                  .then(s => {
                    console.log("email sent to video owner");
                  })
                  .catch(error => {
                    console.log("email not sent to video owner", error);
                  });
                return functions.get("general_emails", {
                  name: "admin_successful_contribution",
                  status: "Y"
                });
              })
              .then(response => {
                if (response.length) {
                  let emailSubject = response[ 0 ].email_subject;
                  let emailContent = response[ 0 ].email_template;
                  emailContent = emailContent.replace(
                    new RegExp("#VIDEO_ID#", "g"),
                    req.body.album_id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#AMOUNT#", "g"),
                    req.body.amount
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#DATE#", "g"),
                    new Date(chargeObj.created)
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#TRAN_ID#", "g"),
                    chargeObj.id
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#METHOD#", "g"),
                    chargeObj.source.object
                  );
                  emailContent = emailContent.replace(
                    new RegExp("#STATUS#", "g"),
                    chargeObj.paid ? "PAID" : "DUE"
                  );
                  const email = { template: emailContent, admin_only: "Y" };
                  functions
                    ._send("", emailSubject, email, true)
                    .then(s => {
                      console.log("email sent to admin");
                    })
                    .catch(error => {
                      console.log("email not sent to admin", error);
                    });
                }
              })
              .catch(error => {
                console.log("Error: ", error);
              });
            res.json({
              status: "success",
              result: {
                message: response[ 0 ].outcome.seller_message,
                paid: response[ 0 ].paid
              }
            });
            next();
          }
        })
        .catch(function (err) {
          res.json({ status: "fail", errors: err });
        });
    } else {
      res.json({
        status: "fail",
        errors: errors
      });
    }
  },
  getContributers(req, res, next) {
    const id = req.params.video_id;
    if (id) {
      postModel
        .getContributers(id)
        .then(response => {
          res.json({
            status: "success",
            result: response
          });
        })
        .catch(error => {
          res.json({
            status: "fail",
            error: error
          });
        });
    }
  },

  async addVideoComment(req, res, next) {

    try {
      
      let params = req.body;
      const addVideoCommentResult = await postModel.addVideoComment(params)
  
      const users = await postModel.getRelatedUserDetails({ type: 'video_comment', video_id: params.video_id, user_id: params.user_id })
  
      // let data = {
      //   user_id: user.user_id,
      //   title: `${user.comment_owner} commented!.`,
      //   message: `${user.comment_owner} commented on your post "${user.title}".`,
      //   image_url: user.user_image,
      //   target_url: '',
      //   is_offer: 0,
      //   is_broadcast: 0,
      //   subscription: user.push_object
      // };
  
      if(users[0].user_id != req.decoded.user_id) {

        let data = {
    
            notification_item_type : "comment",
            notification_item_id : addVideoCommentResult.insertId,
            file_id: params.video_id,
            file_type: "video",
            user_id : users[0].user_id
    
         }

         await functions.insert("notification_master",data)

         const previousPoints = await functions.get("point_master",{
            file_id: params.video_id,
            file_type: "video",
            user_id : users[0].user_id,
            item_type : "comment"
         })

         if(previousPoints.length === 0) {

            const point_confg = await functions.get("points_coins", {
        
                  id : 2
        
            })
    
            const insertPointResult = await functions.insert("point_master", {
        
              item_id : addVideoCommentResult.insertId,
              item_type: "comment",
              point : point_confg[0].points,
              user_id : req.decoded.id,
              scenario_id:"2",
              ip_address: requestIp.getClientIp(req),
              file_id: params.video_id,
              file_type: "video"
    
            })

         }

    

      }

              
  
        //  let payload = {
        //   notification: {
        //     title: data.title,
        //     body: data.message,
        //     icon: 'assets/images/logo.png'
        //   }
        // }
        // await functions.sendWebPush(payload, data.subscription);
  
  
      res.json({
        status: true,
        message: 'Success'
      })

    }
    catch(err){
      
      console.log(err)

    }

  },

  async addPhotoComment(req, res, next) {

    try{
      
        let params = req.body;
    
        const addPhotoCommentResult = await postModel.addPhotoComment(params)
    
    
          // .then(result => {
          //   let promises = [];
          //   let dataArr = [];
        
        const usersResult = await postModel.getRelatedUserDetails({ type: 'photo_comment', photo_id: params.photo_id, user_id: params.user_id })
        
        const user = usersResult[0];
    
        let data = {
    
          notification_item_type : "comment",
          notification_item_id : addPhotoCommentResult.insertId,
          file_id: params.photo_id,
          file_type: "photo",
          user_id : user.user_id
  
       }
        await indexModel.addUserNotification(data);
    
        // let payload = {
        //   notification: {
        //     title: data.title,
        //     body: data.message,
        //     icon: 'assets/images/logo.png'
        //   }
        // }
    
        // await functions.sendWebPush(payload, data.subscription);
    
        res.json({
          status: true,
          message: 'Success'
        });
    }

    catch(err) {
        console.log(err)
    }
    

  },

  getVideoComments(req, res, next) {
    let params = req.body;
    postModel.getVideoCommentsCount(params)
      .then(result => {
        params.count = result[ 0 ].count;
        if(req.decoded && req.decoded.user_id){
          params.user_id = req.decoded.user_id
        }
        return postModel.getVideoComments(params);
      })
      .then(result => {
        if (Array.isArray(result) && result.length) {
          // var comments = [];
          // for (let i = 0; i < result.length; i++) {
          //   if (result[i].reply_to > 0) {
          //     var c_index = result.findIndex(c => { return c.comment_id == result[i].reply_to; });
          //     if (Array.isArray(result[c_index].replies)) {
          //       result[c_index].replies.push(result[i]);
          //     } else {
          //       result[c_index].replies = [];
          //       result[c_index].replies.push(result[i]);
          //     }
          //   }
          // }
          // result = result.filter(r => r.reply_to == 0);
          res.json({
            status: true,
            result: { count: params.count, data: result },
            message: 'Success'
          });
        } else {
          res.json({
            status: true,
            result: { count: 0, data: [] },
            message: 'Success'
          });
        }
      })
      .catch(err => {
        console.log(err)
        res.json({
          status: false,
          message: err
        })
      });
  },

  getPhotoComments(req, res, next) {
    let params = req.body;
    console.log("params", params);
    postModel.getPhotoCommentsCount(params)
      .then(result => {
        params.count = result[ 0 ].count;
        return postModel.getPhotoComments(params);
      })
      .then(result => {
        if (Array.isArray(result) && result.length) {
          res.json({
            status: true,
            result: { count: params.count, data: result },
            message: 'Success'
          });
        } else {
          res.json({
            status: true,
            result: { count: 0, data: [] },
            message: 'Success'
          });
        }
      })
      .catch(err => {
        console.log("errrr", err);
        res.json({
          status: false,
          result: { count: 0, data: [] },
          message: err
        })
      });
  },

  async likeorUnlikeComment(req, res, next) {
    let params = req.body;
    postModel.checkUserHasReaction(params)
      .then(result => {
        if (Array.isArray(result) && result.length) {
          if (result[ 0 ].type == params.type) {
            // undoing the like
            try {
              functions.delete("comment_reaction_master", { comment_id: params.comment_id })
              return null
            }
            catch (err) {
              console.log(err)
              throw err
            }
          } else {
            return postModel.toggleReaction(params);
          }
        } else {
          return postModel.likeorUnlikeComment(params);
        }
      })
      .then(result => {
        if (result) {
          let promises = [];
          let dataArr = [];
          postModel.getCommentType(params.comment_id)
            .then(type => {
              return postModel.getRelatedUserDetails({ type: type[ 0 ].post_type, comment_id: params.comment_id, user_id: params.user_id });
            })
            .then(users => {
              if (Array.isArray(users) && users.length) {
                users.forEach(user => {
                  let data = {
                    user_id: user.user_id,
                    title: params.type ? user.is_owner ? `${user.reaction_owner} liked your comment.` : `${user.reaction_owner} liked a comment.` :
                      user.is_owner ? `${user.reaction_owner} disliked your comment!` : `${user.reaction_owner} disliked a comment!`,
                    message: params.type ? user.is_owner ? `${user.reaction_owner} liked a comment on your post "${user.title}".` :
                      `${user.reaction_owner} liked your comment on post "${user.title}".` : user.is_owner ? `${user.reaction_owner} disliked a comment on your post "${user.title}".` :
                        `${user.reaction_owner} disliked your comment on post "${user.title}".`,
                    image_url: user.user_image,
                    target_url: '',
                    is_offer: 0,
                    is_broadcast: 0,
                    subscription: user.push_object
                  };
                  dataArr.push(data);
                  // promises.push(indexModel.addUserNotification(data));
                });
                return Promise.all(promises)
              } else {
                throw "No users found!";
              }
            })
            .then(result => {
              let notificationPromises = [];
              dataArr.forEach(data => {
                let payload = {
                  notification: {
                    title: data.title,
                    body: data.message,
                    icon: 'assets/images/logo.png'
                  }
                }
                notificationPromises.push(functions.sendWebPush(payload, data.subscription));
              });
              return Promise.all(notificationPromises);
            }).then(result => {
              console.log("Send Notification");
            })
            .catch(err => {
              console.log("Notification error", err);
            })
          res.json({
            status: true,
            message: 'Success'
          });
        }
        else {
          res.json({
            status: true,
            message: 'Success'
          });
        }
      })
      .catch(err => {
        res.json({
          status: false,
          message: err
        })
      });
  },

  getUserDashbord(req, res, next) {
    let body = req.body;
    const decoded = req.decoded;
    if (body.user_id === undefined || body.user_id === 0) {
      body.user_id = decoded.user_id;
    }
    let details = {};
    if (body.user_id) {
      postModel.getUserGroups({ user_id: body.user_id })
        .then(groups => {
          if (Array.isArray(groups) && groups.length) {
            groups.forEach(group => {
              group.group_image = group.group_image == '' || group.group_image == null ? config.groupPlaceholder : group.group_image;
              group.profile_image = group.profile_image == '' || group.profile_image == null ? config.userPlaceholder : group.profile_image;
            });
            details.group = { groupCount: groups.length, data: groups };
          } else {
            details.group = { groupCount: 0, data: [] };
          }
        })
        .then(result => (postModel.getFollowers({ user_id: body.user_id })))
        .then(followers => {
          if (Array.isArray(followers) && followers.length) {
            followers.forEach(follower => {
              follower.profile_image = follower.profile_image == '' || follower.profile_image == null ? config.userPlaceholder : follower.profile_image;
            });
            return details.followers = { followersCount: followers.length, data: followers };
          } else {
            return details.followers = { followersCount: 0, data: [] };
          }
        })
        .then(result => (postModel.getFollowing({ user_id: body.user_id })))
        .then(following => {
          if (Array.isArray(following) && following.length) {
            following.forEach(follow => {
              follow.profile_image = follow.profile_image == '' || follow.profile_image == null ? config.userPlaceholder : follow.profile_image;
            });
            return details.following = { followingCount: following.length, data: following };
          } else {
            return details.following = { followingCount: 0, data: [] };
          }
        })
        .then(result => {
          res.json({
            status: true,
            result: details,
            message: 'Success'
          });
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    } else {
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
    }
  },

  getHomeFeedNew(req, res, next) {
    let body = req.body;
   


    
      postModel.getHomeFeedNew(body)
        .then(feeds => {
          if (Array.isArray(feeds) && feeds.length) {
            feeds.forEach(feed => {
              if (feed.photo_urls != '') {
                feed.photo_urls = feed.photo_urls.split(',');
              } else {
                feed.photo_urls = [];
              }
              if(feed.thumb300x300 != '' && feed.thumb300x300 != null){
                feed.thumb300x300 = feed.thumb300x300.split(',');
              }
              else{
                feed.thumb300x300 = [];
              }
              if(feed.thumb1000x1000 != '' && feed.thumb1000x1000 != null){
                feed.thumb1000x1000 = feed.thumb1000x1000.split(',');
              }
              else{
                feed.thumb1000x1000 = [];
              }
            });
            res.json({
              status: true,
              result: feeds,
              message: 'Success'
            });
          } else {
            res.json({
              status: true,
              result: [],
              message: 'Success'
            });
          }
        })
        .catch(err => {
          console.log(err, "err");
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    
  },

  getHomeFeed(req, res, next) {
    let body = req.body;
    const decoded = req.decoded;
    body.user_id = decoded.user_id;


    if (body.user_id) {
      postModel.getHomeFeed(body)
        .then(feeds => {
          if (Array.isArray(feeds) && feeds.length) {
            feeds.forEach(feed => {
              if (feed.photo_urls != '') {
                feed.photo_urls = feed.photo_urls.split(',');
              } else {
                feed.photo_urls = [];
              }
              console.log(feed.thumb300x300 )
              if(feed.thumb300x300 != '' && feed.thumb300x300 != null){
                feed.thumb300x300 = feed.thumb300x300.split(',');
              }
              else{
                feed.thumb300x300 = [];
              }
              if(feed.thumb1000x1000 != '' && feed.thumb1000x1000 != null){
                feed.thumb1000x1000 = feed.thumb1000x1000.split(',');
              }
              else{
                feed.thumb1000x1000 = [];
              }
            });
            res.json({
              status: true,
              result: feeds,
              message: 'Success'
            });
          } else {
            res.json({
              status: true,
              result: [],
              message: 'Success'
            });
          }
        })
        .catch(err => {
          console.log(err, "err");
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    } else {
      res.status(403).json({
        status: "fail",
        error: "Unauthorized access.",
        errorcode: "serverError"
      });
    }
  },
  getUserDetailsNew(req, res, next) {
    let body = req.body;
    const decoded = req.decoded;
    if(decoded != undefined){
      body.user_id = decoded.user_id;
    }
  
    if (body.public_id == null || body.public_id == undefined) {
      body.public_id = body.user_id;
    }
    user.getPublicUserById(body.user_id, body.public_id)
      .then(result => {
        res.status(200).json({
          status: true,
          result: result[ 0 ]
        });
      })
      .catch(err => {
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      })
  },

  getUserDetails(req, res, next) {
    let body = req.body;
    const decoded = req.decoded;
    body.user_id = decoded.user_id;
    if (body.public_id == null || body.public_id == undefined) {
      body.public_id = body.user_id;
    }
    user.getPublicUserById(body.user_id, body.public_id)
      .then(result => {
        res.status(200).json({
          status: true,
          result: result[ 0 ]
        });
      })
      .catch(err => {
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      })
  },

  getUserGroups(req, res, next) {
    let body = req.body;
   

    postModel.getUserGroups(body)
      .then(result => {
        res.status(200).json({
          status: true,
          result: result
        });
      })
      .catch(err => {
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      })
  },

  getGroupsListing(req, res, next) {
    let body = req.body;
    let trending = [], latest=[], mygroup = [],response={};

    postModel.getUserGroupsListing(body,"trending")
      .then(trendingResult => {
        trending = trendingResult;
        return postModel.getUserGroupsListing(body,"mygroup");
      })
      .then(mygroupResult=>{
        mygroup = mygroupResult;
        return postModel.getUserGroupsListing(body,"latest");
      })
      .then(latestResult=>{

        latest = latestResult;
        
        response = {
          trending:trending,
          mygroup:mygroup,
          latest:latest
        }
        res.status(200).json({
          status: true,
          result: response
        });
      })
      .catch(err => {
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      })
  },
 
  getGroupList(req, res, next) {    //validation
    let params = req.body;
    //  let result=[];
    postModel.getGroupList(params)
      .then(result => {
        res.status(200).json({
          status: true,
          result: result
        });
      })
      .catch(err => {
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      })



  },

  getGroupMembersNew(req, res, next) {
   
    let params = req.body;

    if (!req.body.group_id)
      res.status(403).json({ status: false, error: "group id is required." });
   
    else {
      postModel.getGroupMembersListNew(params)
        .then(result => {
          res.status(200).json({
            status: true,
            result: result
          });
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    }
  },

  getGroupMembers(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;

    if (!req.body.group_id)
      res.status(403).json({ status: false, error: "group id is required." });
    else if (!req.body.user_id)
      res.status(403).json({ status: false, error: "user id is required." });
    else {
      postModel.getGroupMembersList(params)
        .then(result => {
          res.status(200).json({
            status: true,
            result: result
          });
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    }
  },
  
  getGroupDetailsNew(req, res, next) {
  
    let params = req.body;

    if (!req.body.group_id)
      res.status(403).json({ status: false, error: "group id is required." });
   
    else {
      postModel.getGroupDetailsNew(params)
        .then(result => {
          if (result.length) {
            res.json({
              status: true,
              result: result[ 0 ]
            });
          } else {
            res.json({ status: false, error: "Invalid Group." });
          }

        })
        .catch(err => {
          res.json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    }
  },

  getGroupDetails(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;

    if (!req.body.group_id)
      res.status(403).json({ status: false, error: "group id is required." });
    else if (!req.body.user_id)
      res.status(403).json({ status: false, error: "user id is required." });
    else {
      postModel.getGroupDetails(params)
        .then(result => {
          if (result.length) {
            res.json({
              status: true,
              result: result[ 0 ]
            });
          } else {
            res.json({ status: false, error: "Invalid Group." });
          }

        })
        .catch(err => {
          res.json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
    }
  },




  joinGroupMembers(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;
    if (!req.body.group_id)
      res.json({ status: false, error: "group id is required." });
    else if (!req.body.user_id)
      res.json({ status: false, error: "user id is required." });
    else
      //  let result=[];
      postModel.getGroupMembers(params)
        .then(async result => {
          const data = {
            user_id: params.user_id,
            group_id: params.group_id,
            created_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
          };
          if (result.length > 0) {

            const groupAdmin = await functions.get('group_members', { group_id: params.group_id, is_admin: 'Y' })

            let is_admin_left = groupAdmin && groupAdmin instanceof Array && groupAdmin.length > 0 && groupAdmin[ 0 ].user_id == req.decoded.user_id || undefined

            await functions.delete('group_members', { group_id: params.group_id, user_id: params.user_id });

            const groupMembers = await functions.get('group_members', { group_id: params.group_id });

            if(groupMembers.length==0){
              await functions.update('group_master', {deleted_at : moment().utc().format("YYYY-MM-DD HH:mm:ss")} ,  { group_id: params.group_id } );
            }

            else if (is_admin_left) {
              const oldestMember = await postModel.getOldestMember({ group_id: params.group_id })
              if (oldestMember instanceof Array && oldestMember.length > 0 && oldestMember[ 0 ].group_member_id) {
                await functions.update('group_members', { is_admin: 'Y' }, { group_member_id: oldestMember[ 0 ].group_member_id })
              }
            }

            res.json({
              status: true,
              message: "Unjoined",
              is_joined: 'N'
            });
          } else {
            functions.insert('group_members', data);
            res.json({
              status: true,
              message: "Joined",
              is_joined: 'Y'
            });
          }

        })
        .catch(err => {
          res.json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })



  },

  async userFollowUnfollow(req, res, next) {

    req.body.user_id = req.decoded.user_id;

    let params = req.body;
    

    if (!params.follower_id) {
      res
        .status(403)
        .json({ status: false, error: "follower id is required." });
    }
    else {
      try {
        const result = await postModel.userFollowUnfollow(params)

        if (result.length > 0) {
          functions.delete('following_master', { user_id: params.user_id, follower_id: params.follower_id });
          res.status(200).json({
            status: true,
            message: "unfollowed",
            is_following: 'N'
          });
        } else {
          const data = {
            user_id: params.user_id,
            follower_id: params.follower_id,
            created_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
          };
          functions.insert('following_master', data);
          
          const groups = await postModel.getOneToOneGroup({
            user_id : req.decoded.user_id, 
            friend_id : params.follower_id
          })
        
          if (groups.length == 0) {

          const new_group = await functions.insert('group_master', { user_id: req.decoded.user_id, friend_id: params.follower_id, type: 'message' })
 
          await functions.insert('group_members', {
            group_id : new_group.insertId,
            user_id: req.decoded.user_id,
            is_admin:'Y'
          })

          await functions.insert('group_members', {
            group_id : new_group.insertId,
            user_id: req.body.follower_id,
            is_admin:'N'
          })

          res.status(200).json({
              status: true,
              message: "followed",
              is_following: 'Y'
            });
        }
        else{
            res.status(200).json({
              status: true,
              message: "followed",
              is_following: 'Y'
            });
        }
      }
    }
      catch (err) {
        console.log(err)
        res.status(403).json({
          status: false,
          error: err,
          errorcode: "serverError"
        });
      }
    }
  },


  getChatList(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;
    if (!req.body.group_id)
      res
        .status(403)
        .json({ status: false, error: "group id is required." });
    else if (!req.body.user_id)
      res
        .status(403)
        .json({ status: false, error: "user id is required." });
    //  let result=[];
    else
      postModel.getChatList(params)
        .then(result => {
          res.status(200).json({
            status: true,
            result: result
          });
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })



  },

  getChatDetails(req, res, next) {
    console.log('Decoded', req.decoded)
    req.body.user_id = req.decoded.user_id || req.decoded.id;
    let params = req.body;
    if (!params.group_id)
      res
        .status(403)
        .json({ status: false, error: "group id is required." });
    else if (!params.user_id)
      res
        .status(403)
        .json({ status: false, error: "user id is required." });
    //  let result=[];
    else
      postModel.getChatDetails(params)
        .then(result => {
          res.status(200).json({
            status: true,
            result: result
          });
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })



  },
  oneToOneChat(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;
    if (!req.body.friend_id){
      res
        .status(403)
        .json({ status: false, error: "friend id is required." });
    }
    else if (!req.body.user_id){
      res
        .status(403)
        .json({ status: false, error: "user id is required." });
    }
    else{
      postModel.oneToOneChat(params)
        .then(result => {
          if (result.length > 0 && typeof result != undefined) {
            res.status(200).json({
              status: true,
              group_id: result[ 0 ].group_id
            });
          } else {
            res.status(200).json({
              status: false,
            });
          }
        })
        .catch(err => {
          res.status(403).json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })
      }
  },

  followUsers(req, res, next) {
    req.body.user_id = req.decoded.user_id;
    let params = req.body;
    if (!req.body.follower_id)
      res.json({ status: false, error: "follower id is required." });
    else if (!req.body.user_id)
      res.json({ status: false, error: "user id is required." });
    else
      //  let result=[];
      postModel.followUsers(params)
        .then(result => {
          const data = {
            user_id: params.user_id,
            follower_id: params.follower_id,
            created_at: moment().utc().format("YYYY-MM-DD HH:mm:ss")
          };
          if (result.length > 0) {
            functions.delete('following_master', { user_id: params.user_id, follower_id: params.follower_id });
            console.log("deleted");
            res.json({
              status: true,
              message: "Unfollowed",
              is_follow: 'N'

            });
          } else {
            functions.insert('following_master', data);
            res.json({
              status: true,
              message: "followed",
              is_follow: 'Y'
            });
          }

        })
        .catch(err => {
          res.json({
            status: false,
            error: err,
            errorcode: "serverError"
          });
        })



  },

  save_device_token: (req, res, next) => {
    var post = req.body;
    console.log(post, 'post');
    if (post.fcm_id != '') {
      functions.delete('user_device_token_list', {
        fcm_id: post.fcm_id
      });
      var user_id = req.userID;
      functions.insert('user_device_token_list', {
        fcm_id: post.fcm_id,
        device: post.platform,
        user_id: user_id
      }).then(
        result => {
          console.log(result, 'result');
        }
      );
    }
  },


  //   getOtherProfile(req, res, next) {
  //     req.body.user_id = req.decoded.user_id;
  //     let params = req.body;
  //     if (!req.body.friend_id)
  //       res
  //         .status(403)
  //         .json({ status: false, error: "friend id is required." });
  //     else if (!req.body.user_id)
  //       res
  //         .status(403)
  //         .json({ status: false, error: "user id is required." });
  //     //  let result=[];
  //     else
  //       postModel.getOtherProfile(params)
  //         .then(result => {
  //           res.status(200).json({
  //             status: true,
  //             group_id: result.insertId,
  //         })
  //         .catch(err => {
  //           res.status(403).json({
  //             status: false,
  //             error: err,
  //             errorcode: "serverError"
  //           });
  //         })



  //   })
  // },

  getFollowList: (req, res, next) => {
    if (!req.body.type) {
      res.json({
        status: false,
        error: err,
        errorcode: "type is required"
      })
    }
    else {
      const user_id = req.body.user_id && req.body.user_id || req.decoded.user_id
      postModel.getFollowList({
        user_id,
        active: 'Y',
        type: req.body.type
      })
        .then((result) => {
          res.json({
            status: true,
            result
          })
        })
        .catch((err) => {
          res.json({
            status: false,
            error: err,
            errorcode: "type is required"
          })
        })
    }
  },
  isThisVideoOwnerMyfollowing: async (req, res, next) => {
    try {
      result = await postModel.isThisVideoOwnerMyfollowing({ video_id: req.body.video_id, user_id: req.decoded.user_id })
      res.json({
        status: true,
        result
      })
    }
    catch (err) {
      res.json({
        status: false,
        error: err,
      })
    }
  },
  isThisAlbumOwnerMyfollowing: async (req, res, next) => {
    try {
      result = await postModel.isThisAlbumOwnerMyfollowing({ album_id: req.body.album_id, user_id: req.decoded.user_id })
      res.json({
        status: true,
        result
      })
    }
    catch (err) {
      res.json({
        status: false,
        error: err,
      })
    }
  },
  getCount: async (req, res, next) => {
    try {
      if (!req.body.type) {
        res.status(403).json({
          status: false,
          error: "type required"
        })
      }
      else {
        if (req.body.type == 'video') {
          const result = await postModel.getPostCount({
            type: req.body.type
          })
          res.json({
            status: true,
            result: result && result[ 0 ]
          })
        }
        else if (req.body.type == 'photo') {
          const result = await postModel.getPostCount({
            type: req.body.type
          })
          res.json({
            status: true,
            result: result && result[ 0 ]
          })
        }
        

        else {
          res.status(403).json({
            status: false,
            error: "given type not found"
          })
        }
      }
    }
    catch (err) {
      res.json({
        status: false,
        error: err,
      })
    }
  },
  getGroupSubCount: async (req, res, next) => {
    
    try {
      if (!req.body.type) {
        res.status(403).json({
          status: false,
          error: "type required"
        })
      }
      else {
        
        let user_id = req.decoded.user_id;
       
       if (req.body.type == "group") {
          const result = await postModel.getGroupCount({user_id:user_id})
          res.json({
            status: true,
            result: result && result[ 0 ]
          })
        }else if(req.body.type == "subscribe"){
         
          const result = await postModel.getSubscribedCount({
            user_id:user_id
          })
          
          res.json({
            status: true,
            result: result && result[ 0 ]
          })
        }

        else {
          res.status(403).json({
            status: false,
            error: "given type not found"
          })
        }
      }
    }
    catch (err) {
      res.json({
        status: false,
        error: err,
      })
    }
  },
  getImageAd: async (req, res, next) => {
    try {
      let resp = [], body = {};
      postModel.getImageAd()
      .then(async(resp)=>{
        result = resp;
           if(resp.length){
             for(var i=0;i<resp.length;i++){
               body = {
                  advertisement_id: resp[i].id,
                  user_id: req.body.user_id,
                  active: 'Y',
                  ip_address: req.body.ip_address,
                  action_type: 'view',
                  created_at:moment().utc().format("YYYY-MM-DD HH:mm:ss")
               }
               await postModel.addImpression(body);
               await postModel.incrementImpressionCount(resp[i].id);
             }
               
           }
          res.json({
            status: true,
            result: result
          })
      })
      
    }
    catch (err) {
      console.log(err)
      res.status(403).json({
        status: false,
        error: err,
        errorcode: "serverError"
      })
    }
  },
  async ad_redirect(req, res, next) {
    try {
       const clientIp = requestIp.getClientIp(req); 

      if (req.query.ad_banner) {

          const body = {
          advertisement_id: req.query.ad_banner ,
          user_id: req.query.user_id,
          active: 'Y',
          ip_address: clientIp,
          action_type: 'click',
          created_at:moment().utc().format("YYYY-MM-DD HH:mm:ss")
        } 

        const clickLogResult = await functions.insert('photo_ad_log',body)

        const result = await functions.get('photo_advertisement_master', { id: req.query.ad_banner })
        if (result && result instanceof Array && result[ 0 ].target_url) {
          res.status(301).redirect(result[ 0 ].target_url);
          res.end()
          await functions.update('photo_advertisement_master', { no_of_clicks: result[ 0 ].no_of_clicks && result[ 0 ].no_of_clicks + 1 || 1 }, { id: req.query.ad_banner })
        }
      }
    }
    catch (err) {
      console.log(err)
    }
  },
  async getUnreadChatNotification(req, res, next) {
    try {
      const result = await postModel.getUnreadChatNotification({ user_id: req.decoded.user_id })

      res.json({
        status: true,
        result
      })
    }
    catch (err) {
      res.json({
        status: false
      })
    }
  },
  async getMyChatList(req, res, next) {
    try {
      const result = await postModel.getMyChatList({ user_id: req.decoded.user_id , limit : req.body.limit , offset : req.body.offset , search : req.body.search })
      res.json({
        status: true,
        result
      })
    }
    catch (err) {
      res.json({
        status: false
      })
    }
  },
  async getChatGroupDetails(req, res, next) {
    if (req.body.group_id) {
      try {
        const result = await postModel.getChatGroupDetails({ group_id: req.body.group_id, user_id: req.decoded.user_id });
        res.json({
          status: true,
          result: result && result[ 0 ]
        })
      }
      catch (err) {
        res.json({
          status: false
        })
        console.log(err)
      }
    }
    else {
      res.json({
        status: false,
        err: "group id required"
      })
    }
  },
  async getUserDetail(req, res, next) {
    try {
      const result = await postModel.getUserDetail({ user_id: req.decoded.user_id });
      res.json({
        status: true,
        result: result && result[ 0 ]
      })
    }
    catch (err) {
      console.log(err)
      res.json({
        status: false,
        err: err
      })
    }

  },
  async removeFromGroup(req, res, next) {
    try {
      if (!req.body.group_id) {
        res.json({
          status: false,
          err: 'group_id required'
        })
      }
      else {
        const aminMember = await functions.get('group_members', { group_id: req.body.group_id , is_admin : 'Y' })
        if (aminMember && aminMember[ 0 ].user_id == req.decoded.user_id) {
          const result = await functions.delete('group_members', {
            group_id: req.body.group_id,
            user_id: req.body.member_id
          });
          if (result.affectedRows) {
            res.json({
              status: true,
              err: 'failed to remove'
            })
          }
          else {
            res.json({
              status: false,
              err: 'failed to remove'
            })
          }
        }
        else {
          res.json({
            status: false,
            err: 'not admin'
          })
        }
      }
    }
    catch (err) {
      console.log(err)
      res.json({
        status: false,
        err: err
      })
    }
  },
  async setLastread(req, res, next) {
    if (!req.body.group_id) {
      res.json({
        states: false,
        message: 'group_id required'
      })
    }
    else if (!req.body.last_read_message_id) {
      res.json({
        status: false,
        message: 'message_id required'
      })
    }
    else {
      const result = await functions.get('message_read_master', { group_id: req.body.group_id, member_id: req.decoded.user_id })
      let updation;
      if (result instanceof Array && result.length > 0) {
        updation = await functions.update('message_read_master',
          { last_read_message_id: req.body.last_read_message_id },
          { id: result[ 0 ].id });
      }
      else {
        updation = await functions.insert('message_read_master', {
          group_id: req.body.group_id,
          member_id: req.decoded.user_id,
          last_read_message_id: req.body.last_read_message_id
        })
      }

      if (updation.affectedRows) {
        res.json({
          status: true,
          message: 'last read message updated'
        })
      }
      else {
        res.json({
          status: false,
          message: 'failed to update last read message'
        })
      }
    }
  },
  async edit_comment(req, res, next) {
    try {
      if (!req.body.comment_id) {
        res.json({
          status: false,
          message: 'comment id required'
        })
      }
      else if (!req.body.comment) {
        res.json({
          status: false,
          message: 'comment required'
        })
      }
      else {
        const comment = await functions.get("comment_master", { comment_id: req.body.comment_id })
        if (comment[ 0 ].user_id == req.decoded.user_id) {
          const updateCommentResult = await functions.update("comment_master", { comment: req.body.comment }, { comment_id: req.body.comment_id })
          if (updateCommentResult.affectedRows) {
            res.json({
              status: true,
              message: 'updated comment',
              data: { ...comment[ 0 ], comment: req.body.comment }
            })
          }
          else {
            res.json({
              status: false,
              message: 'failed to update comment'
            })
          }
        }
        else {
          res.json({
            status: false,
            message: 'not comment owner'
          })
        }
      }
    }
    catch (err) {
      console.log(err)
      res.json({
        status: false,
        err
      })
    }
  },
  async delete_comment(req, res, next) {
    try {
      if (!req.body.comment_id) {
        res.json({
          status: false,
          message: 'comment id required'
        })
      }
      else {
          const deletdCommentResult = await functions.update("comment_master", { deleted_at: moment().utc().format("YYYY-MM-DD HH:mm:ss") }, { comment_id: req.body.comment_id })
          if (deletdCommentResult.affectedRows) {
            res.json({
              status: true,
              message: 'deleted comment',
            })
            await functions.delete("notification_master", {
              notification_item_id : req.body.comment_id,
              notification_item_type : "comment"
            });

          }
          else {
            res.json({
              status: false,
              message: 'failed to delete comment'
            })
          }
      }
    }
    catch (err) {
      console.log(err)
      res.json({
        states: false,
        err
      })
    }
  },
  async logReaction(req, res, next) {

    try {

      if (!(req.body.video_id ||
        req.body.photo_id ||
        req.body.album_id)

      ) {

        res.json({

          status: false,

          message: 'video_id or photo_id or album_id required'

        })

      }

      else if (!req.body.reaction_type) {

        res.json({

          status: false,

          message: 'reaction_type required'

        })

      }

      else {

        user_id = req.decoded.user_id;

        const {video_id, photo_id , album_id , comment_id, reaction_type } = req.body;

        let data = { user_id }

        if (video_id) {

          data = {...data , item_id : video_id , item_type : "video"}

        }
        else if (photo_id) {

          data = {...data , item_id : photo_id , item_type : "photo"}

        }
        else if (album_id) {

          data = {...data , item_id : album_id , item_type : "album"}

        }
        else if(comment_id) {

          data = {...data , item_id : comment_id , item_type : "comment"}

        }

        const existingReaction = await functions.get("reaction_master", data)

        if(reaction_type==="like" || reaction_type==="unlike"){

          if(existingReaction.length>0){

            if(existingReaction[0].reaction_type!==reaction_type){
              
              await functions.update("reaction_master", {
    
                reaction_type
    
              },data)
              
              req.processed = {
                
                previous_reaction : existingReaction[0].reaction_type,
                reaction_state : "update",
                reaction_id : existingReaction[0].reaction_id
    
              }

            }
            else{

              req.processed = {
                
                previous_reaction : existingReaction[0].reaction_type,
                reaction_state : "nochange",
                reaction_id : existingReaction[0].reaction_id
    
              }

            }
            
  
  
          }
          else{
  
            data = { ...data , reaction_type }
  
            const reaction_addition_result = await functions.insert("reaction_master", data)
  
            req.processed = {
              
              previous_reaction : null,
              reaction_state : "new",
              reaction_id:reaction_addition_result.insertId
  
            }
  
          }

        }

        else if(reaction_type === "undo" ) {

          const reaction_undo_result = await functions.delete("reaction_master", data)

          req.processed = {
              
            previous_reaction : existingReaction[0].reaction_type,
            reaction_state : "undo",
            reaction_id : existingReaction[0].reaction_id

          }

        }
        
        next()

      }
    }
    catch(err){

    }
  },

      async updateItemReactionCount(req,res,next) {

        try{
          
          /**reaction_state
           * ---------------
           * update: changing previous reaction
           * new : new entry
           * undo : undoing previou reaction
           * nochnage : no changes in current reaction
           */
  
          const { video_id, photo_id , album_id , comment_id, reaction_type } = req.body;
  
          const { reaction_state, previous_reaction, reaction_id } = req.processed;
  
          if(reaction_state==="nochange"){
  
            res.json({
              status : true,
              msg : 'no changes'
            })
            return
  
          }
            
            let data = {
    
            }
    
            let point = {
              user_id : req.decoded.id
            }
    
            if (video_id) {
    
              
              let videoDetail = await functions.get('video_master', { id: video_id })
              
              data = { unlikes: parseInt(videoDetail[ 0 ].unlikes) , likes: parseInt(videoDetail[ 0 ].likes) }
              
              point =  {
                ...point,
                point_action_type : reaction_type,
                point_item_id : reaction_id ,
                point_item_type : "reaction",
                reaction_state,
                group_id:videoDetail[0].group_id,
                file_id: video_id,
                file_type:"video"
              }
    
            }
    
            else if(album_id) {
              
              let albumDetail = await functions.get('album_master', { id: req.body.album_id })
    
              data = { unlikes: parseInt( albumDetail[ 0 ].unlikes) , likes: parseInt(albumDetail[ 0 ].likes) }
              
              
  
              point =  {
                ...point,
                point_action_type : reaction_type,
                point_item_id : reaction_id,
                point_item_type : "reaction",
                reaction_state,
                group_id:albumDetail[0].group_id,
                file_id:album_id,
                file_type:"album",
              }
    
            }
    
            if (reaction_state === "update" && req.body.reaction_type === 'like') {
    
              data.unlikes = data.unlikes - 1; data.likes = data.likes + 1;
  
              point.updatePoint = true
    
    
            }
            if (reaction_state === "update" && req.body.reaction_type === 'unlike') {
    
              data.unlikes = data.unlikes + 1; data.likes = data.likes - 1;
              point.updatePoint = true
      
            }
            if(reaction_state === "new" && req.body.reaction_type === 'like') {
              
              data.likes = data.likes + 1;
    
              point.addPoint = true
    
            }
            if(reaction_state === "new" && req.body.reaction_type === 'unlike') {
              
              data.unlikes = data.unlikes + 1;
              
              point.addPoint = true
              
            }
            if(reaction_state ==="undo" && previous_reaction==="like") {
    
              data.likes = data.likes - 1;
    
              point.removePoint = true
    
            }
            if(reaction_state ==="undo" && previous_reaction==="unlike") {
    
              data.unlikes = data.unlikes - 1;
  
              point.removePoint = true
              
            }
    
            if(video_id){
              
              await functions.update('video_master', data, { id: video_id })
            
            }
            else if(album_id){
    
              await functions.update('album_master', data, { id: album_id })
    
            }
            
            const { addPoint , removePoint , updatePoints } = point 
  
            if(addPoint === true || removePoint === true){
  
              req.processed.point = point
  
              next()
              
            }
            
            else{
              
              res.json({
                status : true,
              })
  
            }

        }

        catch(err) {

          console.log(err)

        }



      },

      async updateReactionPoints(req, res, next) {

        try{

          if(req.processed && req.processed.point) {
  
            const { point_action_type, point_item_id, point_item_type, reaction_state, file_id, file_type, group_id } = req.processed.point
         
            if(point_action_type === "like" || point_action_type==="unlike" ||point_action_type === "undo" ){
    
              
              if(reaction_state==="new"){
                
                const previousPoints = await functions.get("point_master", {
                  
                  item_type:point_item_type,
                  user_id : req.decoded.id,
                  file_id,
                  file_type
                  
                })
                
                if(previousPoints.length === 0) {
                  
                  let scenario_id =  group_id ? 3 : 2 

                  const point_confg = await functions.get("points_coins", {
        
                    id : scenario_id
        
                  })

                  const insertPoint = await functions.insert("point_master", {
      
                    item_id : point_item_id,
                    item_type:point_item_type,
                    point : point_confg[0].points,
                    user_id : req.decoded.id,
                    scenario_id,
                    ip_address: requestIp.getClientIp(req),
                    file_id,
                    file_type
                  })

                const userDetail = await functions.get("user_master", {
                    id : req.decoded.user_id
                })

                await functions.update("user_master",{
                   total_point : userDetail[0].total_point + point_confg[0].points
                  },{
                   id: req.decoded.user_id,
                })

                }
                
  
                res.json({
                  status : true
                })
  
              } 
              else if(reaction_state === "undo"){ 

                res.json({
                  status : true
                })

              }
    
            }
  
          }

          next()

        }

        catch(err){
          console.log(err)
        }



      },

      async handleReactionNotification(req, res ,next) {
        
        try{
          
          const {video_id, album_id, reaction_type } = req.body;
    
          const { reaction_state, previous_reaction, reaction_id } = req.processed;
    
          if(reaction_type === "like" || reaction_type === "unlike" || reaction_type === "undo" ){
            
            let data = {
    
              notification_item_type : "reaction",
              notification_item_id : reaction_id
    
            }

            if(video_id) {

              const videoDetail = await functions.get("video_master", {
      
                id : video_id
      
              })

              data = {...data , 
                file_id: video_id,
                file_type: "video",
                 user_id : videoDetail[0].user_id
              } 


            }

            else if(album_id) {

              const albumDetail = await functions.get("album_master", {
      
                id : album_id
      
              })

              data = {...data , 
                file_id: album_id,
                file_type: "album",
                user_id : albumDetail[0].user_id
              } 

            }
            
            
    
            if(reaction_state === "new" ){
    
              functions.insert("notification_master", data)
    
            }

            else if(reaction_state === "update") {

              functions.update("notification_master", data)

            }
            
            else if(reaction_state === "undo") {
    
              functions.delete("notification_master", data)
    
            }
    
          }

        }

        catch(err) {

          console.log(err)

        }


      },
    
  async getMyReaction(req, res, next) {
    try {
      if (!(req.body.video_id ||
        req.body.photo_id ||
        req.body.album_id)
      ) {
        res.json({
          status: false,
          message: 'video_id or photo_id or album_id required'
        })
      }
      else {
        let data = { user_id: req.decoded.user_id }
        if (req.body.video_id) {
          data = {...data, item_type:'video' , item_id:req.body.video_id}
        }
        if (req.body.photo_id) {
          data = {...data, item_type:'photo' , item_id:req.body.photo_id}
        }
        if (req.body.album_id) {
          data = {...data, item_type:'album' , item_id:req.body.album_id}
        }
        const result = await functions.get('reaction_master', data)
        res.json({
          status: true,
          result : result instanceof Array && result[0]
        })
      }
  }
  catch(err){
    res.json({
      states: false,
      err
    })
  }
},
async report(req, res, next){
  try{
    if(!req.body.report_item_id){
      res.json({
        status: false,
        message: 'report_item_id required'
      })
    }
    else if(!req.body.report_type){
      res.json({
        status: false,
        message: 'report_type required'
      })
    }
    else if(!req.body.description){
      res.json({
        status: false,
        message: 'description required'
      })
    }
    else if(!req.body.category_id){
      res.json({
        status: false,
        message: 'category id required'
      })
    }
    else{
      let data = {
        description : req.body.description,
        category_id : req.body.category_id,
        user_id     : req.decoded.user_id,
        report_item_id : req.body.report_item_id,
        report_type : req.body.report_type,
        created_at : moment().utc().format("YYYY-MM-DD HH:mm:ss")
      }
      if(req.body.video_id){
        data.video_id = req.body.video_id
      }
      else if(req.body.album_id) {
        data.album_id = req.body.album_id
      }

      
      const reportInsertResult = await functions.insert('report_master', data)
      
      const point_confg = await functions.get("points_coins", {
  
        id : 7
    
      })

      const pointInsertData = {
        item_id : reportInsertResult.insertId,
        item_type : "report",
        point : point_confg[0].points,
        user_id : req.decoded.id,
        scenario_id : "7",
        ip_address : requestIp.getClientIp(req),
        file_id : req.body.report_item_id,
        file_type : req.body.report_type
        
      }

      await functions.insert("point_master", pointInsertData)

      res.json({
        status: true,
        message: 'reported'
      })

    }
  }
  catch(err){
    res.json({
      status: false,
      message: 'something went wrong'
    })
  }
},
async getReportCategoryList(req, res, next) {
  try{
    const result = await functions.get('report_category_master',{})
  
    res.json({
      status: true,
      result
    })
  }
  catch(err){
    console.log(err)
    res.json({
      status: false,
      message: 'something went wrong'
    })
  }
},
async getWebsiteBanners(req,res,next){
  try{
    const result = await postModel.getWebsiteBanners()
    res.json({
      status:true,
      result
    })
  }
  catch(err){
    console.log(err)
    res.json({
      status: false,
      message: 'something went wrong'
    })
  }
},
getUserSubscribed(req,res,next){
  let body = req.body;
  body.user_id = req.decoded.user_id;

  postModel.getUserSubscribed(body)
    .then(result => {
      res.status(200).json({
        status: true,
        result: result
      });
    })
    .catch(err => {
      res.status(403).json({
        status: false,
        error: err,
        errorcode: "serverError"
      });
    })
},
async getMyPoints(req, res, next) {
  
  try {
    
    const { limit , offset } = req.body
    
    const params = { 

      user_id : req.decoded.user_id,

      offset,

      limit
     
    }

    const myPointsCount = await postModel.getMyTotalPoint(params)
    
    const myPoints = await postModel.getMyPoints(params)

    res.json({
      status:true,
      result: myPoints,
      point : myPointsCount[0].total_points
    })

  }
  catch(err) {
    console.log(err)
    res.status(403).json({
      status: false,
      error: err,
      errorcode: "serverError"
    });
  }

},
async getMyCoins(req, res, next){
    try {
    
    const { limit , offset } = req.body
    
    const params = { 

      user_id : req.decoded.user_id,

      offset,

      limit
     
    }

    const myCoinCount = await postModel.getMyTotalCoins(params)
    
    const myCoins = await postModel.getMyCoins(params)

    res.json({
      status:true,
      result: myCoins,
      coin : myCoinCount[0].count
    })

  }
  catch(err) {
    console.log(err)
    res.status(403).json({
      status: false,
      error: err,
      errorcode: "serverError"
    });
  }
},

async logSkip(req,res,next) {
  const {
        file_id,
        file_type,
        user_id,
        ip_address,
        ad_id,
        skip_duration
  } = req.body
  try{
    await functions.insert("advertisement_log", {
      file_id,
      file_type,
      user_id,
      ip_address,
      advertisement_id:ad_id,
      skip_duration,
      action_type:'skip',
      created_at: new Date()
    })

    res.json({
      status : true,
    })

  }

  catch(err){
    res.json({
      status : false,
      err
    })
  } 

  },
  async editVideoPost(req,res,next) {
    try{
      const { video_id , title , location , description , category_id , ad_position } = req.body
  
      if(!video_id) {
        res.json({
          status : false,
          message : 'video_id required'
        })
      }
      if(!title) {
        res.json({
          status : false,
          message : 'title required'
        })
      }
      if(!location) {
        res.json({
          status : false,
          message : 'location required'
        })
      }
      if(!description) {
        res.json({
          status : false,
          message : 'description required'
        })
      }
      if(!category_id) {
        res.json({
          status : false,
          message : 'category_id required'
        })
      }
      if(!ad_position) {
        res.json({
          status : false,
          message : 'ad_position required'
        })
      }
      else{
  
        const videos = await functions.get("video_master", {
          id : video_id
        })
        
        console.log(             video_id ,
           title ,
           location ,
           description ,
           category_id ,
           ad_position )
        if(videos && videos.length > 0) {
          
          console.log(videos[0].user_id , req.decoded.id)
            if(videos[0].user_id === req.decoded.id) {
  
            await functions.update("video_master",{
               title ,
               location ,
               description ,
               category_id : category_id.map(item=>item.category_id).join(',') ,
               ad_position : ad_position.map(item=>item.position).join(',')
            },{
              id : video_id
            })
  
          res.json({
            status : true ,
            message : "successfully edited"
          })
  
          }
          else{
            
            res.json({
              status : false,
              message : "not autherized to edit"
            })

          }
  
        }
        else{
          res.json({
            status : false,
            message : "video does not exist"
          })
        }
      }  
    }
    catch(err){
      console.log(err)
        res.json({
          err,
          status : false
        })
    }
  },
  async editAlbum(req,res,next) {
    if(!req.body.album_id) {
      res.json({
        status : false,
        message : "album_id required"
      })
    }
    else if(!req.body.category_id) {
      res.json({
        status : false,
        message : "category_id required"
      })
    }
    else if(!req.body.description) {
      res.json({
        status : false,
        message : "description required"
      })
    }
    else if(!req.body.location) {
      res.json({
        status : false,
        message : "location required"
      })
    }
    else if(!req.body.title) {
      res.json({
        status : false,
        message : "title required"
      })
    }
    else{

      const video = await functions.get("album_master", {
        id : req.body.album_id
      })

      if(video && video[0].user_id  == req.decoded.id) {
        const { title , description , location, category_id } = req.body
        
        await functions.update("album_master", {
           album_name : title,
        }, {
          id : req.body.album_id
        })

        await functions.update("photo_master", {
          title,
          category_id : req.body.category_id.map(cat=>cat.category_id).join(','),
          description,
          location
        }, {
          album_id : req.body.album_id
        })

        res.json({
          status : true ,
          message : "successfully edited"
        })

      }
      else {
        res.json({
          status : false ,
          message : "not autherized to edit"
        })
      }
    }
  },
  async deleteAlbum(req,res,next){

    const { album_id } =  req.body;

    if(album_id) {

      const album = await functions.get("album_master", {
        id : album_id
      })
      console.log(album)
      if(album[0].user_id === req.decoded.id){
        functions.update("album_master", {
          deleted_at : moment().utc().format("YYYY-MM-DD HH:mm:ss")
        }, {
          id : album_id
        })
  
        res.json({
          status : true,
          message : 'Album deleted'
        })

      }
      else{
        res.json({
          status : false, 
          message : 'not autherized'
        })
      }


    }
    else{
      res.json({
        status : false,
        message : 'album_id required'
      })
    }

  }
}


module.exports = handler;
