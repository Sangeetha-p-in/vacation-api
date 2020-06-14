let functions = require("../helpers/functions"),
  mysql = require("mysql"),
  config = require("../server/config"),
  moment = require("moment");
const s3Url = "https://vacationbucket.s3.us-east-2.amazonaws.com/"
const s3thumb300x300 = "thumbnails/300x300/";
const s3thumb1000x1000 = "thumbnails/1000x1000/"
let postModel = {
  insertUserPosts(postDetails) {
    if (postDetails) return functions.insert("user_posts", postDetails);
    else
      return new Promise((resolve, reject) => {
        reject("Invalid Request.");
      });
  },

  createUserPost(postData) {
    if (postData) return functions.insert("video_master", postData);
    else
      return new Promise((resolve, reject) => {
        reject("Post creation failed!");
      });
  },

  createAlbum(params) {
    return new Promise((resolve, reject) => {
      if (!params.album_id) {
        const data = {
          album_name: params.title,
          created_at: params.created_at,
          user_id: params.user_id
        };
        
        if(params.group_id) {
          data.group_id = params.group_id
        }

        functions
          .insert("album_master", data)
          .then(result => {
            params.album_id = result.insertId;
            resolve(params);
          })
          .catch(err => {
            reject("Album creation failed");
          });
      } else {
        resolve(params);
      }
    });
  },

  createUserImagePost(postData) {
    const dataArray = [];
    return new Promise((resolve, reject) => {
      if (Array.isArray(postData.image_url)) {
        let keys;
        if (postData.group_id && postData.group_id != undefined && postData.group_id != null) {
          keys = "(album_id, user_id, title, description, category_id, s3key, photo_url, location, active, created_at, group_id)";
        } else {
          keys = "(album_id, user_id, title, description, category_id, s3key, photo_url, location, active, created_at)";
        }

        postData.image_url.forEach((url,index) => {
          let data;
          if (postData.group_id && postData.group_id != undefined && postData.group_id != null) {
            data = [
              postData.album_id,
              postData.user_id,
              postData.title,
              postData.description,
              postData.category_id,
              postData.s3key[index],
              url,
              postData.location,
              1,
              postData.created_at,
              postData.group_id
            ];
          } else {
            data = [
              postData.album_id,
              postData.user_id,
              postData.title,
              postData.description,
              postData.category_id,
              postData.s3key[index],
              url,
              postData.location,
              1,
              postData.created_at
            ];
          }
          dataArray.push(data);
        });
        if (dataArray.length)
          functions
            .insertMultiple("photo_master", keys, dataArray)
            .then(result => {
              resolve(postData);
            })
            .catch(err => {
              reject("DB Error");
            });
      } else {
        reject("No data found");
      }
    });
  },

  getAlbums(params) {
    return new Promise((resolve, reject) => {
      let param = [];
      let sql = `SELECT
      (
          SELECT
            CONCAT("[", GROUP_CONCAT('{"category_name" :"' , category_name, '",' , '"category_id" :' , category_id, "}") , "]" )
          FROM
            category_master cm
          WHERE
            FIND_IN_SET (cm.category_id,
            P.category_id) 
      ) as category_arr ,
      A.id, A.user_id, A.album_name, A.created_at AS album_created_at, A.likes, A.unlikes, CONCAT(U.first_name,' ',U.last_name) AS user_name , U.first_name ,U.last_name ,
      (SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id AND PM.deleted_at IS NULL) AS image_count,
      CONCAT('${s3Url}',U.profile_image) as profile_image, P.category_id, P.title, P.description, P.photo_url, P.total_views, P.location, P.created_at AS image_uploaded_at, IFNULL(P.total_views,0) AS total_views, P.id AS image_id
      FROM photo_master P 
      LEFT JOIN album_master A ON A.id = P.album_id
      LEFT JOIN user_master U ON U.id = A.user_id
      WHERE ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)`;

      if (params.user_id) {
        sql += ` AND P.user_id=?`;
        param.push(params.user_id);
      }
      if (params.query) {
        sql += ` AND (P.title LIke %?% OR P.location LIKE %?% OR P.description LIKE %?%)`;
        param.push.apply(params, [ params.query, params.query, params.query ]);
      }
      if ("album_id" in params) {
        sql += ` AND A.id=?`;
        param.push(params.album_id);
      } else {
        sql += ` GROUP BY A.id`;
      }
      if (params.sort) {
        sql += ` ORDER BY P.created_at`;
      } else {
        //default sorting
        sql += ` ORDER BY P.created_at`;
      }
      if(params.offset != undefined && params.limit) {
        sql += ` limit ${params.offset} , ${params.limit} `
      }
      functions
        .processQuery(sql, param)
        .then(result => {
          if (Array.isArray(result) && result.length) {
            params.albums = result;
          } else params.albums = [];
          resolve(params);
        })
        .catch(err => {
         
          reject("DB error");
        });
    });
  },
  getCategorizedPhotos(params,type){
    return new Promise((resolve, reject) => {
      let param = [],response=[];
      let sql = `SELECT A.id, A.user_id, A.album_name, A.created_at AS album_created_at, A.likes, A.unlikes, CONCAT(U.first_name,' ',U.last_name) AS user_name , U.first_name ,U.last_name ,
      (SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id AND PM.deleted_at IS NULL) AS image_count,
      (SELECT COUNT(id)  FROM photo_view_log WHERE album_id = P.album_id AND unique_view = 'Y' ) AS album_count,
       CONCAT('${s3Url}',U.profile_image) as profile_image, P.category_id, P.title, P.description, P.photo_url, CONCAT('${s3Url+s3thumb300x300}',P.s3key) thumb300x300, P.total_views, P.location, P.created_at AS image_uploaded_at, IFNULL(P.total_views,0) AS total_views, P.id AS image_id
      FROM photo_master P 
      LEFT JOIN album_master A ON A.id = P.album_id
      LEFT JOIN user_master U ON U.id = A.user_id`;

      if(type !== undefined && (type == 'trending' || type =='most_viewed')){
        sql = `${sql} LEFT JOIN photo_view_log PL ON A.id = PL.album_id`;
      }

     sql= `${sql} WHERE A.active="Y" AND ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)`;

     if(type !== undefined && type == 'trending'){
      sql = `${sql} AND PL.date_time > DATE_SUB(now(), INTERVAL 2 MONTH)`;
    }
    if(type !== undefined && (type == 'trending' || type =='most_viewed')){
      sql = `${sql} AND (SELECT COUNT(id)  FROM photo_view_log WHERE album_id = P.album_id AND unique_view = 'Y' ) > 0`;
    }

      if (params.user_id) {
        sql += ` AND P.user_id=?`;
        param.push(params.user_id);
      }
      if (params.query) {
        sql += ` AND (P.title LIke %?% OR P.location LIKE %?% OR P.description LIKE %?%)`;
        param.push.apply(params, [ params.query, params.query, params.query ]);
      }
     
        sql += ` GROUP BY A.id`;
     
      if(type !== undefined && (type == 'trending' || type =='most_viewed')){
        sql = `${sql} ORDER BY album_count DESC`;
      }
      if (type !== undefined && type == 'latest') {
        sql += ` ORDER BY A.created_at DESC`;
      } 
      if(params.offset != undefined && params.limit) {
        sql += ` limit ${params.offset} , ${params.limit} `
      }
      console.log("trypeihere",type,sql);
      functions
        .processQuery(sql, param)
        .then(result => {
         
          if (Array.isArray(result) && result.length) {
             response =  result;
          } else response = [];
          resolve(response);
        })
        .catch(err => {
         
          reject("DB error");
        });
    });

  },
  getPhotos({ limit, offset }) {
    let sql = `select 
    A.id as post_id ,
    B.photo_url photo,
    A.album_name as title,
    B.user_id as post_user_id,
    CONCAT('${s3Url}',C.profile_image) as profile_image
    B.photo_thumb as thumb,
    concat(C.first_name , ' ' , C.last_name ) user_name,
    C.first_name ,
    C.last_name ,
    B.total_views
    from album_master A
    left join photo_master B on A.id = B.album_id
    left join user_master C on C.id = A.user_id `

    if (typeof (limit) == 'number' && typeof (offset) == 'number') {
      sql += ` LIMIT ${offset}, ${limit}`
    }

    return functions.selectQuery(sql)
  },
  getPostByUserID(
    user_id = "",
    post_type = "campaign",
    offset = 0,
    limit = 10,
    search = ""
  ) {
    if (user_id) {
      let sql = `SELECT 
                    user_posts.*
                   FROM user_posts WHERE user_posts.user_master_user_id=${user_id} AND user_posts.post_type=${mysql.escape(
        post_type
      )}`;

      if (search)
        sql = `${sql} AND (user_posts.title LIKE '%${search}%' OR user_posts.business_industry LIKE '%${search}%')`;

      sql = `${sql} ORDER BY user_posts.created_time DESC LIMIT ${offset}, ${limit}`;

      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  getMyPostCount(user_id = "", post_type = "campaign", search = "") {
    if (user_id) {
      let sql = `SELECT COUNT(*) as count FROM user_posts WHERE user_posts.user_master_user_id=${user_id} AND user_posts.post_type=${mysql.escape(
        post_type
      )}`;

      if (search)
        sql = `${sql} AND (user_posts.title LIKE '%${search}%' OR user_posts.business_industry LIKE '%${search}%')`;

      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  getPostForCustomer(
    user = {},
    post_type = "campaign",
    count = false,
    offset = 0,
    limit = 10
  ) {
    if (user) {
      let sql = `SELECT * FROM (SELECT                
                    user_posts.*,
                    DATEDIFF('${moment().format(
        "YYYY-MM-DD HH:mm:ss"
      )}', user_posts.created_time) as period,
                    IF(POSITION(',' IN user_posts.sex) > 0,			
                        IF(SUBSTR(user_posts.sex, 1, POSITION(',' IN user_posts.sex)-1)='${
        user.gender
        }' OR 
                            SUBSTR(user_posts.sex, POSITION(',' IN user_posts.sex) + 1)='${
        user.gender
        }', 1, 0), IF(user_posts.sex='${
        user.gender
        }', 1, 0)) as gender_match_status,
                
                     (6371  * acos( cos( radians(${
        user.lat
        }) ) * cos( radians( user_posts.post_lat ) ) * 
                        cos( radians( user_posts.post_lng ) - radians(${
        user.lng
        }) ) + sin( radians(${user.lat}) ) * 
                        sin( radians( user_posts.post_lat ) ) ) ) AS distance
                
                FROM user_posts ) as TMP 
                WHERE TMP.post_status='Y'
                AND TMP.post_type='${post_type}'
                AND ${user.age} BETWEEN TMP.from_age AND TMP.to_age
                AND TMP.gender_match_status = 1
                AND TMP.target_industry_id=${user.industries_industry_id}
                AND TMP.period <= ${user.period}
                HAVING TMP.distance <= ${
        user.radius
        } ORDER BY TMP.created_time DESC`;

      if (!count) sql += ` LIMIT ${offset}, ${limit}`;

      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  postDetailsById(post_id = 0) {
    if (post_id) {
      sql = `SELECT
                        user_master.user_id,
                        user_master.first_name,
                        user_master.last_name,
                        user_details.address,
                        user_details.profile_photo,
                        user_details.city,
                        user_details.description as about_us,                        
                        user_posts.*,
                        user_fb_details.fb_id
                    
                    FROM user_posts
                    
                    INNER JOIN user_master ON user_posts.user_master_user_id = user_master.user_id

                    LEFT JOIN user_fb_details ON user_fb_details.user_master_user_id = user_posts.user_master_user_id
                    
                    LEFT JOIN user_details ON user_details.user_master_user_id = user_posts.user_master_user_id
                    
                    WHERE user_posts.post_status = 'Y' AND user_posts.post_id = ${post_id}`;

      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  getPostCount(body) {
    let sql = `SELECT COUNT(*) as count FROM (
      (
        SELECT
          VM.id AS post_id,
          VM.user_id,
          VM.title,
          VM.description,
          VM.video_thumb AS thumb,
          CONCAT(
            user_master.first_name,
            ' ',
            user_master.last_name
          ) AS user_name,
          0 AS image_count,
          CONCAT('${s3Url}',U.profile_image) as profile_image,
          "video" AS type,
          VM.created_at
        FROM
          video_master VM
        INNER JOIN user_master ON VM.user_id = user_master.id
        LEFT JOIN category_master ON category_master.category_id = VM.category_id
        WHERE
          (
            VM.active = 'Y'
            AND VM.deleted_at IS NULL
            AND user_master.active = 'Y'
            AND user_master.deleted_at IS NULL
          )
      )
      UNION
        (
          SELECT
            A.id AS post_id,
            A.user_id,
            A.album_name AS title,
            P.description,
            P.photo_url AS thumb,
            CONCAT(
              U.first_name,
              ' ',
              U.last_name
            ) AS user_name,
            (
              SELECT
                COUNT(DISTINCT PM.id)
              FROM
                photo_master PM
              WHERE
                PM.album_id = A.id
            ) AS image_count,
            CONCAT('${s3Url}',U.profile_image) as profile_image,
            "photo" AS type,
            A.created_at
          FROM
            photo_master P
          LEFT JOIN album_master A ON A.id = P.album_id
          LEFT JOIN user_master U ON U.id = A.user_id
          WHERE
            ISNULL(P.deleted_at)
          AND ISNULL(A.deleted_at)
          GROUP BY
            A.id
          ORDER BY
            P.created_at DESC
        ) ) AS D
    `;

    if (body.search)
      sql = `${sql} WHERE (D.title LIKE '%${
        body.search
        }%' OR D.description LIKE '%${body.search}%')`;
    if (body.search && body.type) sql = `${sql} AND`;
    if (!body.search && body.type) sql = `${sql} WHERE`;
    if (body.type) {
      sql = `${sql} D.type='${body.type}'`;
    }

    if (body.offset != undefined && body.limit)
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;
   
    return functions.selectQuery(sql);
  },



  getPosts(body) {
    let sql = `SELECT * FROM ((
      SELECT
        VM.id AS post_id,
        VM.user_id,
        VM.title,
        VM.description,
        VM.video_thumb AS thumb,
        CONCAT(
          user_master.first_name,
          ' ',
          user_master.last_name
        ) AS user_name,
        0 AS image_count,
        CONCAT('${s3Url}',user_master.profile_image) as profile_image,
        "video" AS type,
        VM.created_at
      FROM
        video_master VM
      INNER JOIN user_master ON VM.user_id = user_master.id
      LEFT JOIN category_master ON category_master.category_id = VM.category_id
      WHERE
        (
          VM.active = 'Y'
          AND VM.deleted_at IS NULL
          AND user_master.active = 'Y'
          AND user_master.deleted_at IS NULL
        )
    )
    UNION
      (
        SELECT
          A.id AS post_id,
          A.user_id,
          A.album_name AS title,
          P.description,
          P.photo_url AS thumb,
          CONCAT(
            U.first_name,
            ' ',
            U.last_name
          ) AS user_name,
          (
            SELECT
              COUNT(DISTINCT PM.id)
            FROM
              photo_master PM
            WHERE
              PM.album_id = A.id
          ) AS image_count,
          CONCAT('${s3Url}',U.profile_image) as profile_image,
          "photo" AS type,
          A.created_at
        FROM
          photo_master P
        LEFT JOIN album_master A ON A.id = P.album_id
        LEFT JOIN user_master U ON U.id = A.user_id
        WHERE
          ISNULL(P.deleted_at)
        AND ISNULL(A.deleted_at)
        GROUP BY
          A.id
      ) ) AS D`;

    if (body.search)
      sql = `${sql} WHERE (D.title LIKE '%${
        body.search
        }%' OR D.description LIKE '%${body.search}%')`;
    if (body.search && body.type) sql = `${sql} AND`;
    if (!body.search && body.type) sql = `${sql} WHERE`;
    if (body.type) {
      sql = `${sql} D.type='${body.type}'`;
    }

    sql = `${sql} ORDER BY
    D.created_at DESC`;

    if (body.offset != undefined && body.limit)
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;

   

    return functions.selectQuery(sql);
  },
  getSearchVideos({ search , limit , offset }) {
    let sql = `SELECT
    VM.id AS post_id,
    VM.user_id,
    VM.title,
    VM.description,
    VM.video_thumb AS thumb,
    CONCAT(
      user_master.first_name,
      ' ',
      user_master.last_name
    ) AS user_name,
    total_views,
    CONCAT('${s3Url}',user_master.profile_image) as profile_image,
    "video" AS type,
    VM.created_at
  FROM
    video_master VM
  INNER JOIN user_master ON VM.user_id = user_master.id
  LEFT JOIN category_master ON category_master.category_id = VM.category_id
  WHERE
      VM.active = 'Y'
      AND VM.deleted_at IS NULL
      AND user_master.active = 'Y'
      AND user_master.deleted_at IS NULL
      `
      if(search) {
        sql+= ` AND VM.title like "%${search}%"`
      }

      if(typeof limit == 'number' && typeof offset == "number" ) {
        sql += ` LIMIT ${limit*offset},${limit}` 
      }

    return functions.selectQuery(sql);
  },
  getSearchPhotos({ search , limit , offset}) {
    let sql = `SELECT
    A.id AS post_id,
    A.user_id,
    A.album_name AS title,
    P.description,
    P.photo_url AS thumb,
    CONCAT(
      U.first_name,
      ' ',
      U.last_name
    ) AS user_name,
    (
      SELECT
        COUNT(DISTINCT PM.id)
      FROM
        photo_master PM
      WHERE
        PM.album_id = A.id
    ) AS image_count,
    CONCAT('${s3Url}',U.profile_image) as profile_image,
    "photo" AS type,
    A.created_at
  FROM
    photo_master P
  LEFT JOIN album_master A ON A.id = P.album_id
  LEFT JOIN user_master U ON U.id = A.user_id
  WHERE
    ISNULL(P.deleted_at)
  AND ISNULL(A.deleted_at) `

  if(search) {
    sql+= ` AND A.album_name like "%${search}%" `
  }
  sql+= ` GROUP BY
    A.id`
  
  if(typeof limit == 'number' && typeof offset == "number" ) {
      sql += ` LIMIT ${limit*offset},${limit}` 
  }
    return functions.selectQuery(sql);
  },

  getVideoCount(body) {
    let sql = `SELECT COUNT(*) as count FROM video_master INNER JOIN user_master ON video_master.user_id = user_master.id WHERE video_master.deleted_at IS NULL AND user_master.deleted_at iS NULL AND video_master.active = 'Y' AND user_master.active = 'Y'`;

    if (body.search)
      sql = `${sql} AND (video_master.title LIKE '%${
        body.search
        }%' OR video_master.description LIKE '%${body.search}%')`;

    if (body.sort)
      switch (body.sort) {
        case "recent":
          sql = `${sql} ORDER BY video_master.created_at DESC`;
          break;
        case "top_grossing":
          sql = `${sql} ORDER BY video_master.total_earning DESC`;
          break;
        case "most_popular":
          sql = `${sql} ORDER BY video_master.total_views DESC`;
          break;
      }
      
    if (body.offset != undefined && body.limit)
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;
     
    
    return functions.selectQuery(sql);
  },

  getCategorizedVideos(body,type){

    let sql = `SELECT
        video_master.video_url as video_url,
        video_master.id as post_id,
        video_master.video_thumb as thumb,
        video_master.active as active,
        video_master.created_at as created_at,
        video_master.deleted_at as deleted_at,
        video_master.updated_at as updated_at,
        video_master.total_views as total_views,
        video_master.total_earning as total_earning,
        video_master.title as title,
        category_master.category_name AS category,
        user_master.unique_id AS user_unique_id,
        video_master.user_id as post_user_id,
        user_master.first_name,
        user_master.last_name,
        CONCAT('${s3Url}',user_master.profile_image) as profile_image             
      FROM video_master
      INNER JOIN user_master ON video_master.user_id = user_master.id
      LEFT JOIN category_master ON category_master.category_id = video_master.category_id`;

      if(type !==undefined && (type=="most_viewed"|| type=="trending")){
         sql = `${sql} LEFT JOIN video_view_log ON video_master.id = video_view_log.video_id`;
      }
      
      
     sql = `${sql} WHERE (video_master.active = 'Y' AND video_master.deleted_at IS NULL AND user_master.active = 'Y' AND user_master.deleted_at IS NULL  )`;
  
    if (body.search)
      sql = `${sql} AND (video_master.title LIKE '%${
        body.search
        }%' OR video_master.description LIKE '%${body.search}%')`;

        if(type !==undefined && type=="trending"){
            sql = `${sql} AND video_view_log.date_time > DATE_SUB(now(), INTERVAL 2 MONTH)`;
        }
        if(type !==undefined && (type=="most_viewed"|| type=="trending")){
          sql = `${sql} AND video_master.total_views > 0 GROUP BY video_view_log.video_id ORDER BY video_master.total_views DESC`;
        }

        if(type !== undefined && type == "latest"){
           sql= `${sql} ORDER BY video_master.created_at DESC`;
        }

    if (body.offset != undefined && body.limit)
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;


    return functions.selectQuery(sql)

  },

  getVideos(body) {
    let sql = `SELECT
                  video_master.video_url as video_url,
                  video_master.id as post_id,
                  video_master.video_thumb as thumb,
                  video_master.active as active,
                  video_master.created_at as created_at,
                  video_master.deleted_at as deleted_at,
                  video_master.updated_at as updated_at,
                  video_master.total_views as total_views,
                  video_master.total_earning as total_earning,
                  video_master.title as title,
                  category_master.category_name AS category,
                  user_master.unique_id AS user_unique_id,
                  video_master.user_id as post_user_id,
                  user_master.first_name,
                  user_master.last_name,
                  CONCAT('${s3Url}',user_master.profile_image) as profile_image
                FROM video_master
                INNER JOIN user_master ON video_master.user_id = user_master.id
                LEFT JOIN category_master ON category_master.category_id = video_master.category_id
                WHERE (video_master.active = 'Y' AND video_master.deleted_at IS NULL AND user_master.active = 'Y' AND user_master.deleted_at IS NULL )  `;

    if (body.search)
      sql = `${sql} AND (video_master.title LIKE '%${
        body.search
        }%' OR video_master.description LIKE '%${body.search}%')`;

    if (body.sort)
      switch (body.sort) {
        case "recent":
          sql = `${sql} ORDER BY video_master.created_at DESC`;
          break;
        case "top_grossing":
          sql = `${sql} ORDER BY video_master.total_earning DESC`;
          break;
        case "most_popular":
          sql = `${sql} ORDER BY video_master.total_views DESC`;
          break;
      }

    if (body.offset != undefined && body.limit)
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;

   
    return functions.selectQuery(sql);
  },

  deleteVideo(id) {
    return functions.update(
      "video_master",
      {
        deleted_at: moment().format("YYYY-MM-DD HH:mm:ss")
      },
      {
        id: id
      }
    );
  },

  getAlbumDetailsByImage(image_id) {
    let sql = `SELECT A.id, A.user_id, A.album_name, A.created_at AS album_created_at,
    (SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id AND PM.deleted_at IS NULL) AS image_count,
    P.id AS image_id
    FROM photo_master P 
    LEFT JOIN album_master A ON A.id = P.album_id
    LEFT JOIN user_master U ON U.id = A.user_id
    WHERE P.id=${image_id}`;
    return functions.selectQuery(sql);
  },

  deletePhoto(id) {
    return functions.update(
      "photo_master",
      {
        deleted_at: moment().format("YYYY-MM-DD HH:mm:ss")
      },
      {
        id: id
      }
    );
  },

  getPostDetails(id) {
    if (id) {
      let sql = `SELECT video_master.*,
      IFNULL(video_master.ad_position,0) as positions,
      user_master.unique_id AS user_unique_id,
      user_master.first_name,
      user_master.last_name,
      user_master.image,
      CONCAT('${s3Url}',user_master.profile_image) as profile_image,
      duration,
           (
          SELECT
            CONCAT("[", GROUP_CONCAT('{"category_name" :"' , category_name, '",' , '"category_id" :' , category_id, "}") , "]" )
          FROM
            category_master cm
          WHERE
            FIND_IN_SET (cm.category_id,
            video_master.category_id) 
      ) as category_arr,
          (
          SELECT
          CONCAT("[", GROUP_CONCAT('{"position" :"' , AVP.position, '",' , '"positionLbl" :"' , AVP.positionLbl, '"}') , "]" )
        FROM
          ad_video_positions AVP
        WHERE
          FIND_IN_SET (AVP.position,
          video_master.ad_position) 
      )as position_arr

      FROM video_master INNER JOIN user_master ON video_master.user_id = user_master.id
      WHERE video_master.id = ${id} AND (video_master.deleted_at IS NULL
      AND video_master.active = 'Y' AND user_master.active = 'Y' AND user_master.deleted_at IS NULL)`;
     
      return functions.selectQuery(sql);
    }
  },

  getRandomAds({limit,category_id,country_code,user_lat,user_lng,distance}) {
    console.log("ldfhkdsfsdf")
    // let sql = `SELECT r1.id as ad_id, r1.title as ad_title, r1.video_url as ad_video_url, r1.target_url, r1.provider_name as ad_provider_name FROM advertisement_master AS r1 JOIN (SELECT (RAND() * (SELECT MAX(id) FROM advertisement_master)) AS id)
    //     AS r2 WHERE r1.current_view < r1.max_view AND r1.active = 'Y' AND r1.deleted_at IS NULL`;
        
    //     sql = `${sql} AND (`;

    //      for(var i = 0;i<category_id.length;i++){
    //        sql = `${sql}  ${category_id[i]} IN (r1.category_id) OR`;
    //      }

    //    sql = `${sql} 1 ) ORDER BY RAND() limit ${limit}`;
    // const user_lat = "10.0531";
    // const user_lng = "76.3528"; 

      let sql = `SELECT 
                  A.id as ad_id,
                  A.title as ad_title,
                  A.video_url as ad_video_url,
                  A.target_url,
                  A.provider_name as ad_provider_name,
                  A.location_type,
                  D.loc_code,
                  D.loc_lat,
                  D.loc_lng,
                  D.loc_code,
                  D.location_type
                  FROM advertisement_master A
                  LEFT JOIN advertisement_locations B ON A.id = B.advertisement_id AND A.location_type= "all" 
                  LEFT JOIN advertisement_locations C ON A.id = C.advertisement_id AND A.location_type= "other" 
                  LEFT JOIN location_master D ON C.location_id = D.id
                  WHERE A.active='Y' AND ISNULL(A.deleted_at) AND ((A.location_type="all") AND A.max_view > A.current_view` 
                  
                  if(country_code) {
                    sql += ` OR (D.loc_code = "${country_code}" AND D.location_type ="country") ` 
                  }

                  if(user_lat && user_lng) {
                    sql+= ` OR (D.location_type = "region" 
                    AND
                    ROUND(111.045 * DEGREES(ACOS(COS(RADIANS(D.loc_lat))
                            * COS(RADIANS(${user_lat}))
                            * COS(RADIANS(${user_lng}) - RADIANS(D.loc_lng))
                            + SIN(RADIANS(D.loc_lat))
                            * SIN(RADIANS(${user_lat})))) ,0 ) < ${distance}
                        )`
                  }

        sql += `) AND (`;

        for(var i = 0;i<category_id.length;i++){
           sql += `   ${category_id[i]} IN (A.category_id) OR`;
         }

         sql += ` 1 )`

        sql+=` GROUP BY A.id ORDER BY RAND() limit ${limit}`
         console.log(sql)
      return functions.selectQuery(sql);
  },

  getUserPostsCount(body) {
    if (body.user_id) {
      let sql = `SELECT COUNT(*) as count FROM video_master WHERE video_master.user_id=${
        body.user_id
        } AND video_master.deleted_at IS NULL AND video_master.active = 'Y'`;

      if (body.search)
        sql = `${sql} AND (video_master.title LIKE '%${
          body.search
          }%' OR video_master.description LIKE '%${body.search}%')`;

      if (body.offset != undefined && body.limit)
        sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;

      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  getUserPosts(body) {
    if (body.user_id) {
      let sql = `SELECT video_master.*,
                  user_master.first_name,
                  user_master.last_name,
                  user_master.image,
                  CONCAT('${s3Url}',user_master.profile_image) as profile_image
                  FROM video_master INNER JOIN user_master on video_master.user_id = user_master.id WHERE video_master.user_id=${
        body.user_id
        } AND (video_master.deleted_at IS NULL AND user_master.deleted_at IS NULL AND video_master.active = 'Y' AND user_master.active = 'Y')`;
      if (body.search)
        sql = `${sql} AND (video_master.title LIKE '%${
          body.search
          }%' OR video_master.description LIKE '%${body.search}%')`;

      if (body.offset != undefined && body.limit)
        sql = `${sql} ORDER BY video_master.created_at DESC LIMIT ${
          body.offset
          }, ${body.limit}`;
      return functions.selectQuery(sql);
    } else
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
  },

  checkUniqueView(video_id, user_id, ip_address) {
    let sql = `SELECT COUNT(*) AS count FROM video_view_log WHERE video_view_log.video_id = ${video_id}`;
    if (user_id && ip_address) {
      `${sql} AND ( video_view_log.user_id = ${user_id} AND video_view_log.ip_address = "${ip_address}" )`;
    } else if (user_id && !ip_address)
      sql = `${sql} AND video_view_log.user_id = ${user_id}`;
    else if (!user_id && ip_address)
      sql = `${sql} AND video_view_log.ip_address = "${ip_address}"`;
    return functions.selectQuery(sql);
  },
  checkTodayUniqueView(video_id, user_id, ip_address) {
    let sql = `SELECT COUNT(*) AS count FROM video_view_log WHERE video_view_log.video_id = ${video_id}`;
    if (user_id && ip_address) {
      sql = `${sql} AND ( video_view_log.user_id = ${user_id} AND video_view_log.ip_address = "${ip_address}" )`;
    } else if (user_id && !ip_address)
      sql = `${sql} AND video_view_log.user_id = ${user_id}`;
    else if (!user_id && ip_address)
      sql = `${sql} AND video_view_log.ip_address = "${ip_address}"`;

    sql = `${sql} AND DATE_FORMAT(date_time,"%Y-%m-%d") = DATE_FORMAT(NOW(),"%Y-%m-%d") AND unique_view="Y"`
    console.log(sql)
    return functions.selectQuery(sql);

  },

  checkUniquePhotoView(photo_id, user_id, ip_address) {
    let sql = `SELECT COUNT(*) AS count FROM photo_view_log WHERE photo_view_log.photo_id = ${photo_id}`;
    if (user_id && ip_address) {
      `${sql} AND ( photo_view_log.user_id = ${user_id} AND photo_view_log.ip_address = "${ip_address}" )`;
    } else if (user_id && !ip_address)
      sql = `${sql} AND photo_view_log.user_id = ${user_id}`;
    else if (!user_id && ip_address)
      sql = `${sql} AND photo_view_log.ip_address = "${ip_address}"`;

    sql = `${sql} AND DATE_FORMAT(date_time,"%Y-%m-%d") = DATE_FORMAT(NOW(),"%Y-%m-%d")`
    return functions.selectQuery(sql);
  },
  checkTodayUniquePhotoView(photo_id, user_id, ip_address) {
    let sql = `SELECT COUNT(*) AS count FROM photo_view_log WHERE photo_view_log.photo_id = ${photo_id}`;
    if (user_id && ip_address) {
      `${sql} AND ( photo_view_log.user_id = ${user_id} AND photo_view_log.ip_address = "${ip_address}" )`;
    } else if (user_id && !ip_address)
      sql = `${sql} AND photo_view_log.user_id = ${user_id}`;
    else if (!user_id && ip_address)
      sql = `${sql} AND photo_view_log.ip_address = "${ip_address}"`;

    sql = `${sql} AND DATE_FORMAT(date_time,"%Y-%m-%d") = DATE_FORMAT(NOW(),"%Y-%m-%d") AND unique_view="Y"`
    return functions.selectQuery(sql);
  },

  logVideoView(video_id, user_id, ip_address, unique) {
    if (video_id && (user_id || ip_address)) {
      let data = {
        user_id: user_id,
        video_id: video_id,
        ip_address: ip_address,
        unique_view: unique,
        date_time: new Date()
      };
      return functions.insert("video_view_log", data);
    } else {
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
    }
  },

  logPhotoView(photo_id, user_id, ip_address,album_id, unique) {
    if (photo_id && (user_id || ip_address)) {
      let data = {
        user_id: user_id,
        photo_id: photo_id,
        ip_address: ip_address,
        album_id:album_id,
        unique_view: unique,
        date_time: new Date()
      };
      return functions.insert("photo_view_log", data);
    } else {
      new Promise((resolve, reject) => {
        reject("Invalid Request");
      });
    }
  },

  getUniqueVideoCount(video_id) {
    if (video_id) {
      let sql = `SELECT COUNT(*) AS view_count FROM video_view_log WHERE video_id = ${video_id} AND unique_view = 'Y'`;
      return functions.selectQuery(sql);
    }
  },

  getUniquePhotoCount(photo_id) {
    if (photo_id) {
      let sql = `SELECT COUNT(*) AS view_count FROM photo_view_log WHERE photo_id = ${photo_id} AND unique_view = 'Y'`;
      return functions.selectQuery(sql);
    }
  },

  updateUniqueViewCount(video_id, count) {
    if (video_id && count) {
      return functions.update(
        "video_master",
        { total_views: count },
        { id: video_id }
      );
    }
  },

  updateUniquePhotoViewCount(photo_id, count) {
    if (photo_id && count) {
      return functions.update(
        "photo_master",
        { total_views: count },
        { id: photo_id }
      );
    }
  },

  getRecommendedVideos(params) {
    let sql = `SELECT A.*,
    B.first_name,
    B.last_name,
    CONCAT('https://vacationbucket.s3.us-east-2.amazonaws.com/',B.profile_image) as image
  FROM video_master A
  INNER JOIN user_master B ON A.user_id = B.id
  WHERE 
  (A.deleted_at IS NULL AND A.active = 'Y') 
  AND ISNULL(B.deleted_at)
  AND B.active = "Y"
  AND B.deleted_at IS NULL 
  AND B.active = 'Y'
  AND A.id != ${params.video_id}
  ORDER BY RAND()
  LIMIT 8`;
console.log(sql)
    return functions.selectQuery(sql);
  },
  getRecommendedAlbums({ limit, offset }) {
    let sql = `SELECT album_master.*,
    user_master.first_name,
    user_master.last_name,
    CONCAT('${s3Url}',user_master.profile_image) as image,
    photo_master.photo_thumb,
    photo_master.photo_url
  FROM album_master
  INNER JOIN photo_master ON photo_master.album_id = album_master.id
  INNER JOIN user_master ON album_master.user_id = user_master.id
  WHERE (album_master.deleted_at IS NULL ) AND user_master.deleted_at IS NULL AND user_master.active = 'Y'
  ORDER BY RAND()`
    if (limit != undefined && offset != undefined) {
      sql += ` limit ${offset},${limit} `
    }
  
    return functions.selectQuery(sql);
  },
  getContributers(video_id) {
    let sql = `SELECT user_master.id,
      video_earnings.video_id,
      user_master.first_name,
      user_master.last_name,
      video_earnings.contributer_name,
      user_master.email,
      CONCAT('${s3Url}',user_master.profile_image) as image,
      user_master.city,
      video_earnings.note,
      SUM(video_earnings.amount) AS total_earning,
      video_earnings.created_at AS contributed_at FROM user_master
      INNER JOIN video_earnings ON video_id = ${video_id}
      AND user_master.id = video_earnings.user_id
      GROUP BY video_earnings.user_id;`;

    return functions.selectQuery(sql);
  },

  getViewVideoPoint() {
    let sql = `SELECT value as view_video_point from general_config WHERE field = 'video_view_point'`;
    return functions.selectQuery(sql);
  },

  getViewPhotoPoint() {
    let sql = `SELECT value as view_photo_point from general_config WHERE field = 'photo_view_point'`;
    return functions.selectQuery(sql);
  },

  checkUserGotPointFromVideo(data) {
    let sql = `SELECT COUNT(*) as point_count FROM point_master WHERE user_id = ${
      data.user_id
      } AND item_id = ${data.video_id} AND item_type='video'`;
    return functions.selectQuery(sql);
  },

  checkUserGotPointFromPhoto(data) {
    let sql = `SELECT COUNT(*) as point_count FROM point_master WHERE user_id = ${
      data.user_id
      } AND item_id = ${data.photo_id} AND item_type='photo'`;
    return functions.selectQuery(sql);
  },

  getUserTotalPoint(user_id) {
    let sql = `SELECT SUM(point) as total_point FROM point_master WHERE user_id = ${user_id}`;
    return functions.selectQuery(sql);
  },

  addPoint(data) {
    let sql = `INSERT IGNORE INTO point_master SET ?`;
    return functions.processQuery(sql, data);
  },

  logAdView(param) {
    return functions.insert("advertisement_log", param);
  },

  getAdPosition(){
    let sql = `SELECT position,positionLbl,id FROM ad_video_positions WHERE active = 'Y'`;
    return functions.selectQuery(sql);
  },

  updateAdViewCount(ad_id) {
    let sql = `UPDATE advertisement_master AS dest, (SELECT current_view FROM advertisement_master WHERE id = ${ad_id}) AS src
              SET dest.current_view = (src.current_view + 1) WHERE dest.id = ${ad_id}`;

    return functions.processQuery(sql, {});
  },
  updateAdClickCount(ad_id){
    let sql = `UPDATE advertisement_master AS dest, (SELECT click_count FROM advertisement_master WHERE id = ${ad_id}) AS src
    SET dest.click_count = (src.click_count + 1) WHERE dest.id = ${ad_id}`;

    return functions.processQuery(sql, {});
  },

  updateVideoEarning(video_id) {
    let sql = `UPDATE video_master AS dest, (SELECT total_earning FROM video_master WHERE id = ${video_id}) AS src
    SET dest.total_earning = (IFNULL(src.total_earning,0) + 0.0001) WHERE dest.id = ${video_id}`;

    return functions.processQuery(sql, {});
  },

  addVideoComment(params) {
    let data = {
      user_id: params.user_id,
      comment: params.comment,
      reply_to: params.reply_to || 0,
      video_id: params.video_id,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss")
    };
    return functions.insert("comment_master", data);
  },

  addPhotoComment(params) {
    let data = {
      user_id: params.user_id,
      comment: params.comment,
      reply_to: params.reply_to || 0,
      photo_id: params.photo_id,
      created_at: moment().format("YYYY-MM-DD HH:mm:ss")
    };
    return functions.insert("comment_master", data);
  },

  checkUserHasReaction(params) {
    let sql = `SELECT id, type FROM comment_reaction_master R WHERE R.comment_id=${
      params.comment_id
      } AND R.user_id=${params.user_id}`;
    return functions.selectQuery(sql);
  },

  getVideoCommentsCount(params) {
    let sql = `SELECT COUNT(DISTINCT C.comment_id) as count
    FROM comment_master C
    WHERE C.video_id=${params.video_id} AND C.deleted_at IS NULL`;
    if (params.reply_to) {
      sql += ` AND C.reply_to=` + params.reply_to;
    } else {
      sql += ` AND C.reply_to=0`;
    }
    return functions.selectQuery(sql);
  },

  getPhotoCommentsCount(params) {
    let sql = `SELECT COUNT(DISTINCT C.comment_id) as count
    FROM comment_master C
    WHERE C.photo_id=${params.photo_id} AND C.deleted_at IS NULL`;
    if (params.reply_to) {
      sql += ` AND C.reply_to=` + params.reply_to;
    } else {
      sql += ` AND C.reply_to=0`;
    }
    return functions.selectQuery(sql);
  },

  getVideoComments(params) {
    let sql = `SELECT C.*, CONCAT(U.first_name,' ',U.last_name) AS full_name, U.email,
             CONCAT('${s3Url}',U.profile_image) as image,
              (SELECT COUNT(DISTINCT R.id) FROM comment_reaction_master R WHERE
                      R.type=1 AND R.comment_id = C.comment_id) AS likes,
              (SELECT COUNT(DISTINCT R.id) FROM comment_reaction_master R WHERE
                      R.type=0 AND R.comment_id = C.comment_id) AS unlikes`;
    if (params.user_id != undefined) {
      sql = `${sql}, IF((SELECT R2.type FROM comment_reaction_master R2 WHERE R2.comment_id=C.comment_id AND R2.user_id=${
        params.user_id
        }) = 0,
        0, IF((SELECT R2.type FROM comment_reaction_master R2 WHERE R2.comment_id=C.comment_id AND R2.user_id=${
        params.user_id
        }) = 1, 1, -1  )  ) AS user_reacted`;
    }
    sql = `${sql} FROM comment_master C
      LEFT JOIN user_master U ON U.id = C.user_id
      WHERE C.video_id=${params.video_id} AND C.deleted_at IS NULL`;
    if (params.reply_to) {
      sql = `${sql} AND C.reply_to = ${params.reply_to}`;
    } else {
      sql = `${sql} AND C.reply_to = 0`;
    }
    sql = `${sql} ORDER BY C.created_at DESC`;
    if (params.offset != undefined && params.limit != undefined)
      sql = `${sql} LIMIT ${params.offset}, ${params.limit}`;
    return functions.selectQuery(sql);
  },

  getPhotoComments(params) {
    let sql = `SELECT C.*, CONCAT(U.first_name,' ',U.last_name) AS full_name, U.email,
    CONCAT('${s3Url}',U.profile_image) as image,
              (SELECT COUNT(DISTINCT R.id) FROM comment_reaction_master R WHERE
                      R.type=1 AND R.comment_id = C.comment_id) AS likes,
              (SELECT COUNT(DISTINCT R.id) FROM comment_reaction_master R WHERE
                      R.type=0 AND R.comment_id = C.comment_id) AS unlikes`;
    if (params.user_id != undefined) {
      sql = `${sql}, IF((SELECT R2.type FROM comment_reaction_master R2 WHERE R2.comment_id=C.comment_id AND R2.user_id=${
        params.user_id
        }) = 0,
        0, IF((SELECT R2.type FROM comment_reaction_master R2 WHERE R2.comment_id=C.comment_id AND R2.user_id=${
        params.user_id
        }) = 1, 1, -1  )  ) AS user_reacted`;
    }
    sql = `${sql} FROM comment_master C
      LEFT JOIN user_master U ON U.id = C.user_id
      WHERE C.photo_id=${params.photo_id} AND C.deleted_at IS NULL`;
    if (params.reply_to) {
      sql = `${sql} AND C.reply_to = ${params.reply_to}`;
    } else {
      sql = `${sql} AND C.reply_to = 0`;
    }
    sql = `${sql} ORDER BY C.created_at DESC`;
    if (params.offset != undefined && params.limit != undefined)
      sql = `${sql} LIMIT ${params.offset}, ${params.limit}`;
    return functions.selectQuery(sql);
  },

  likeorUnlikeComment(params) {
    let data = {
      comment_id: params.comment_id,
      user_id: params.user_id,
      type: params.type,
      reacted_at: moment().format("YYYY-MM-DD HH:mm:ss")
    };
    return functions.insert("comment_reaction_master", data);
  },

  toggleReaction(params) {
    let sql = `UPDATE comment_reaction_master R SET R.type=${
      params.type
      } WHERE R.comment_id=${params.comment_id} AND R.user_id=${params.user_id}`;
    return functions.processQuery(sql, {});
  },

  getRelatedUserDetails(params) {
    let sql = ``;
    switch (params.type) {
      case "video_comment":
        sql += `SELECT U.id AS user_id, U.email, U.first_name, U.last_name, UO.image AS user_image, U.push_object,
          VM.title, CONCAT(UO.first_name,' ',UO.last_name) AS comment_owner
          FROM video_master VM 
          LEFT JOIN user_master U ON U.id=VM.user_id
          LEFT JOIN user_master UO ON UO.id = ${params.user_id}
          WHERE VM.id=${params.video_id}`;
        break;
      case "react_photo_comment":
        sql += `SELECT U.id AS user_id, U.email, U.first_name, U.last_name, UO.image AS user_image, U.push_object,
        PM.title, IF((U.id=PM.user_id), true, false) AS is_owner, CONCAT(UO.first_name,' ',UO.last_name) AS reaction_owner
        FROM comment_master CM
        LEFT JOIN photo_master PM ON PM.id=CM.photo_id
        LEFT JOIN user_master U ON U.id=CM.user_id OR U.id=PM.user_id
        LEFT JOIN user_master UO ON UO.id = ${params.user_id}
        WHERE CM.comment_id=${params.comment_id}`;
        break;
      case "photo_comment":
        sql += `SELECT U.id AS user_id, U.email, U.first_name, U.last_name, UO.image AS user_image, U.push_object,
          PM.title, CONCAT(UO.first_name,' ',UO.last_name) AS comment_owner
          FROM photo_master PM 
          LEFT JOIN user_master U ON U.id=PM.user_id
          LEFT JOIN user_master UO ON UO.id = ${params.user_id}
          WHERE PM.id=${params.photo_id}`;
        break;
      case "react_video_comment":
        sql += `SELECT U.id AS user_id, U.email, U.first_name, U.last_name, UO.image AS user_image, U.push_object,
          VM.title, IF((U.id=VM.user_id), true, false) AS is_owner, CONCAT(UO.first_name,' ',UO.last_name) AS reaction_owner
          FROM comment_master CM
          LEFT JOIN video_master VM ON VM.id=CM.video_id
          LEFT JOIN user_master U ON U.id=CM.user_id OR U.id=VM.user_id
          LEFT JOIN user_master UO ON UO.id = ${params.user_id}
          WHERE CM.comment_id=${params.comment_id}`;
        break;
    }
    if (sql) return functions.selectQuery(sql);
    else return "";
  },

  getCommentType(comment_id) {
    let sql = `SELECT IF(ISNULL(CM.photo_id), 'react_video_comment', 'react_photo_comment') AS post_type FROM comment_master CM WHERE CM.comment_id = ${comment_id}`;
    return functions.selectQuery(sql);
  },
  getUserDetails(body) {
    let sql = `SELECT first_name,last_name,image,zipcode,city from user_master WHERE user_id=${user_id}`;
    return functions.selectQuery(sql);
  },


  getUserGroupsListing(user = {},type) {

    user.limit = user.limit && user.limit != undefined ? user.limit : config.limit;
    user.offset = user.offset != undefined && user.offset ? (user.offset - 1) * user.limit : 0;
    let sql = `SELECT GM.group_id,
                  GM.user_id as user_id,
                      GM.group_name,
                      GM.description,
                      GM.image as group_image,
                      DATE_FORMAT(GM.created_at, '%Y-%m-%d %H:%i:%s') as datee,
                      CONCAT(UM.first_name, ' ', UM.last_name) as user_name,
                      CONCAT('${s3Url}',UM.profile_image) as profile_image,
                      (SELECT COUNT(VM.id)  FROM video_master VM WHERE VM.group_id =  GM.group_id AND VM.active="Y" ) video_post_count,
                      (SELECT COUNT(AM.id)  FROM album_master AM LEFT JOIN photo_master PM ON PM.album_id = AM.id WHERE PM.group_id =  GM.group_id ) album_post_count,
                (SELECT COUNT(group_member_id) FROM group_members WHERE group_id = GM.group_id) as member_count
              FROM group_master GM 
              LEFT JOIN user_master UM ON UM.id = GM.user_id WHERE 1`;

    
    if (user.user_id != undefined && user.user_id && type !== undefined && type == 'mygroup') {
      sql = `${sql} AND GM.group_id IN(SELECT group_id FROM group_members GM WHERE GM.user_id = ${user.user_id})`;
    }
    sql = `${sql} AND type = 'normal' 
              AND GM.deleted_at IS NULL`;
    
    if(type !== undefined && type == 'trending'){
      sql = `${sql} ORDER BY (video_post_count + album_post_count) DESC`;
    }
    if(type !== undefined && (type == 'latest' || type == 'mygroup')){
         sql = `${sql} GROUP BY GM.group_id
         ORDER BY GM.group_id DESC`;
    }
    if (user.offset != undefined && user.limit) {
      sql = `${sql} LIMIT ${user.offset}, ${user.limit}`;
    }
    
    return functions.selectQuery(sql);
  },

  getUserGroups(user = {},type) {

    user.limit = user.limit && user.limit != undefined ? user.limit : config.limit;
    user.offset = user.offset != undefined && user.offset ? (user.offset - 1) * user.limit : 0;
    let sql = `SELECT GM.group_id,
                  GM.user_id as user_id,
                      GM.group_name,
                      GM.description,
                      GM.image as group_image,
                      DATE_FORMAT(GM.created_at, '%Y-%m-%d %H:%i:%s') as datee,
                      CONCAT(UM.first_name, ' ', UM.last_name) as user_name,
                      CONCAT('${s3Url}',UM.profile_image) as profile_image,
                      (SELECT COUNT(VM.id)  FROM video_master VM WHERE VM.group_id =  GM.group_id AND VM.active="Y" ) video_post_count,
                      (SELECT COUNT(AM.id)  FROM album_master AM LEFT JOIN photo_master PM ON PM.album_id = AM.id WHERE PM.group_id =  GM.group_id AND AM.active="Y" ) album_post_count,
                (SELECT COUNT(group_member_id) FROM group_members WHERE group_id = GM.group_id) as member_count
              FROM group_master GM 
              LEFT JOIN user_master UM ON UM.id = GM.user_id WHERE 1`;
    if (user.user_id != undefined && user.user_id) {
      sql = `${sql} AND  GM.group_id IN(SELECT group_id FROM group_members GM WHERE GM.user_id = ${user.user_id})`;
    }
    sql = `${sql} AND type = 'normal' 
              AND GM.deleted_at IS NULL`;
    sql = `${sql} GROUP BY GM.group_id  ORDER BY GM.group_id DESC`;
    if (user.offset != undefined && user.limit) {
      sql = `${sql} LIMIT ${user.offset}, ${user.limit}`;
    }
    
    return functions.selectQuery(sql);
  },

  getFollowers(user) {
    let sql = `SELECT 
                CONCAT(UM.first_name, ' ', UM.last_name) as user_name,
                CONCAT('${s3Url}',UM.profile_image) as profile_image,
                UM.id as user_id,
                DATE_FORMAT(FM.created_at, '%Y-%m-%d %H:%i:%s') as created_at
              FROM following_master FM
              LEFT JOIN user_master UM ON FM.user_id = UM.id
              WHERE FM.follower_id = ${user.user_id}`;
    return functions.selectQuery(sql);
  },

  getFollowing(user) {
    let sql = `SELECT 
                CONCAT(UM.first_name, ' ', UM.last_name) as user_name,
                CONCAT('${s3Url}',UM.profile_image) as profile_image,
                UM.id as user_id,
                DATE_FORMAT(FM.created_at, '%Y-%m-%d %H:%i:%s') as created_at
              FROM following_master FM
              LEFT JOIN user_master UM ON FM.follower_id = UM.id
              WHERE FM.user_id = ${user.user_id}`;

    return functions.selectQuery(sql);
  },


  getHomeFeedNew(body) {
    body.limit = body.limit && body.limit != undefined ? body.limit : config.limit;
    body.offset = body.offset != undefined && body.offset ? (body.offset - 1) * body.limit : 0;
    let sql = '';
    if (body.type != undefined && body.type == 'video') {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      VM.id AS post_id,
                      CONCAT('video_',VM.id) as unique_id,
                      VM.user_id,
                      VM.title,
                      VM.description,
                      '' as thumb300x300,
                      '' as thumb1000x1000,
                      VM.video_thumb AS thumb,
                      '' AS photo_urls,
                      CONCAT( user_master.first_name, ' ', user_master.last_name ) AS user_name,
                      0 AS image_count,
                      CONCAT('${s3Url}',user_master.profile_image) as profile_image,
                      "video" AS type,`
                      if(body.user_id != undefined){
                       sql = `${sql} IF (VM.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,`
                      }
                     
                     sql = `${sql} (SELECT count(*) FROM video_view_log VVL WHERE VVL.video_id = VM.id AND unique_view = 'Y' ) AS view_count,
                      VM.created_at,
                      VM.group_id
                    FROM
                      video_master VM
                    INNER JOIN user_master ON VM.user_id = user_master.id
                    LEFT JOIN category_master ON category_master.category_id = VM.category_id
                    WHERE VM.active = 'Y' AND VM.deleted_at IS NULL AND user_master.active AND user_master.deleted_at IS NULL
                  )
                ) AS D
            WHERE 1  `;
    } else if (body.type != undefined && body.type == 'photo') {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      A.id AS post_id,
                      CONCAT('photo_',A.id) as unique_id,
                      A.user_id,
                      A.album_name AS title,
                      P.description,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb300x300}',P.s3key)  SEPARATOR ',') as thumb300x300,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb1000x1000}',P.s3key)  SEPARATOR ',') as thumb1000x1000,
                      P.photo_url AS thumb,
                      GROUP_CONCAT(P.photo_url SEPARATOR ',') AS photo_urls,
                      CONCAT( U.first_name, ' ', U.last_name ) AS user_name,
                      ( SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id ) AS image_count,
                      CONCAT('${s3Url}',U.profile_image) as profile_image,
                      "photo" AS type,`
                      if(body.user_id != undefined){
                        sql = `${sql} IF (A.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,`
                      }
                      sql = `${sql} ( SELECT count(*) FROM photo_view_log PVL WHERE PVL.photo_id = P.id AND unique_view = 'Y' ) AS view_count,
                      A.created_at,
                      P.group_id
                    FROM
                      photo_master P
                    LEFT JOIN album_master A ON A.id = P.album_id
                    LEFT JOIN user_master U ON U.id = A.user_id
                    WHERE ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)
                    GROUP BY A.id
                  )
                ) AS D
            WHERE 1  `;
    } else {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      VM.id AS post_id,
                      CONCAT('video_',VM.id) as unique_id,
                      VM.user_id,
                      VM.id file_id,
                      "video" as file_type,
                      VM.title,
                      VM.description,
                      '' as thumb300x300,
                      '' as thumb1000x1000,
                      VM.video_thumb AS thumb,
                      '' AS photo_urls,
                      CONCAT( user_master.first_name, ' ', user_master.last_name ) AS user_name,
                      0 AS image_count,
                      CONCAT('${s3Url}',user_master.profile_image) as profile_image,
                      "video" AS type,`
                      if(body.user_id != undefined){
                       sql = `${sql} IF (VM.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,`
                      }
                       sql = `${sql} (SELECT count(*) FROM video_view_log VVL WHERE VVL.video_id = VM.id AND unique_view = 'Y' ) AS view_count,
                      VM.created_at,
                      VM.group_id
                    FROM
                      video_master VM
                    INNER JOIN user_master ON VM.user_id = user_master.id
                    LEFT JOIN category_master ON category_master.category_id = VM.category_id
                    WHERE VM.active = 'Y' AND VM.deleted_at IS NULL AND user_master.active AND user_master.deleted_at IS NULL
                  )
                  UNION
                  (
                    SELECT
                      A.id AS post_id,
                      CONCAT('photo_',A.id) as unique_id,
                      A.user_id,
                      A.id file_id,
                      "album" as file_type,
                      A.album_name AS title,
                      P.description,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb300x300}',P.s3key)  SEPARATOR ',') as thumb300x300,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb1000x1000}',P.s3key)  SEPARATOR ',') as thumb1000x1000,
                      P.photo_url AS thumb,
                      GROUP_CONCAT(P.photo_url SEPARATOR ',') AS photo_urls,
                      CONCAT( U.first_name, ' ', U.last_name ) AS user_name,
                      ( SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id ) AS image_count,
                      CONCAT('${s3Url}',U.profile_image) as profile_image,
                      "photo" AS type,`
                      if(body.user_id != undefined){
                         sql = `${sql} IF (A.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,`
                      }
                      sql = `${sql} ( SELECT count(*) FROM photo_view_log PVL WHERE PVL.photo_id = P.id AND unique_view = 'Y' ) AS view_count,
                      A.created_at,
                      P.group_id
                    FROM
                      photo_master P
                    LEFT JOIN album_master A ON A.id = P.album_id
                    LEFT JOIN user_master U ON U.id = A.user_id
                    WHERE ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)
                    GROUP BY A.id
                  )
                ) AS D
            WHERE 1  `;
    }

    if (body.group_id > 0 && body.group_id != undefined) {
      sql += `AND D.group_id ='${body.group_id}'`; ///
    } else if (body.profile_id && body.profile_id != undefined) {
      sql += `AND D.user_id = ${body.profile_id}
            OR D.user_id IN(
              SELECT  
                IF(following_master.user_id = ${
        body.profile_id
        }, following_master.follower_id, following_master.user_id) 
                FROM  following_master  
                WHERE user_id = ${body.profile_id} OR follower_id = ${body.profile_id}
            ) `;
    } else {
      if(body.user_id != undefined){
          sql += `AND D.user_id = ${body.user_id}
              OR D.user_id IN(
                SELECT  
                  IF(following_master.user_id = ${
          body.user_id
          }, following_master.follower_id, following_master.user_id) 
                  FROM  following_master  
                  WHERE user_id = ${body.user_id} OR follower_id = ${body.user_id}
              ) `;
      }
      
    }

    sql += ` ORDER BY D.created_at DESC`;

    // if (body.search)
    //   sql = `${sql} WHERE (D.title LIKE '%${body.search}%' OR D.description LIKE '%${body.search}%')`;
    // if (body.search && body.type) sql = `${sql} AND`;
    // if (!body.search && body.type) sql = `${sql} WHERE`;
    // if (body.type) {
    //   sql = `${sql} D.type='${body.type}'`;
    // }

    // sql = `${sql} ORDER BY
    // D.created_at DESC`;

    if (body.offset != undefined && body.limit) {
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;
    }

 

    return functions.selectQuery(sql);
  },




  getHomeFeed(body) {
    body.limit = body.limit && body.limit != undefined ? body.limit : config.limit;
    body.offset = body.offset != undefined && body.offset ? (body.offset - 1) * body.limit : 0;
    let sql = '';
    if (body.type != undefined && body.type == 'video') {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      VM.id AS post_id,
                      CONCAT('video_',VM.id) as unique_id,
                      VM.user_id,
                      VM.title,
                      VM.description,
                      '' as thumb300x300,
                      '' as thumb1000x1000,
                      VM.video_thumb AS thumb,
                      '' AS photo_urls,
                      CONCAT( user_master.first_name, ' ', user_master.last_name ) AS user_name,
                      0 AS image_count,
                      CONCAT('${s3Url}',user_master.profile_image) as profile_image,
                      "video" AS type,
                      IF (VM.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,
                      (SELECT count(*) FROM video_view_log VVL WHERE VVL.video_id = VM.id AND unique_view = 'Y' ) AS view_count,
                      VM.created_at,
                      VM.group_id
                    FROM
                      video_master VM
                    INNER JOIN user_master ON VM.user_id = user_master.id
                    LEFT JOIN category_master ON category_master.category_id = VM.category_id
                    WHERE VM.active = 'Y' AND VM.deleted_at IS NULL AND user_master.active AND user_master.deleted_at IS NULL
                  )
                ) AS D
            WHERE 1  `;
    } else if (body.type != undefined && body.type == 'photo') {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      A.id AS post_id,
                      CONCAT('photo_',A.id) as unique_id,
                      A.user_id,
                      A.album_name AS title,
                      P.description,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb300x300}',P.s3key)  SEPARATOR ',') as thumb300x300,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb1000x1000}',P.s3key)  SEPARATOR ',') as thumb1000x1000,
                      P.photo_url AS thumb,
                      GROUP_CONCAT(P.photo_url SEPARATOR ',') AS photo_urls,
                      CONCAT( U.first_name, ' ', U.last_name ) AS user_name,
                      ( SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id ) AS image_count,
                      CONCAT('${s3Url}',U.profile_image) as profile_image,
                      "photo" AS type,
                      IF (A.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,
                      ( SELECT count(*) FROM photo_view_log PVL WHERE PVL.photo_id = P.id AND unique_view = 'Y' ) AS view_count,
                      A.created_at,
                      P.group_id
                    FROM
                      photo_master P
                    LEFT JOIN album_master A ON A.id = P.album_id
                    LEFT JOIN user_master U ON U.id = A.user_id
                    WHERE ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)
                    GROUP BY A.id
                  )
                ) AS D
            WHERE 1  `;
    } else {
      sql = `SELECT *
                FROM
                (
                  (
                    SELECT
                      VM.id AS post_id,
                      CONCAT('video_',VM.id) as unique_id,
                      VM.user_id,
                      VM.title,
                      VM.description,
                      '' as thumb300x300,
                      '' as thumb1000x1000,
                      VM.video_thumb AS thumb,
                      '' AS photo_urls,
                      CONCAT( user_master.first_name, ' ', user_master.last_name ) AS user_name,
                      0 AS image_count,
                      CONCAT('${s3Url}',user_master.profile_image) as profile_image,
                      "video" AS type,
                      IF (VM.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,
                      (SELECT count(*) FROM video_view_log VVL WHERE VVL.video_id = VM.id AND unique_view = 'Y' ) AS view_count,
                      VM.created_at,
                      VM.group_id
                    FROM
                      video_master VM
                    INNER JOIN user_master ON VM.user_id = user_master.id
                    LEFT JOIN category_master ON category_master.category_id = VM.category_id
                    WHERE VM.active = 'Y' AND VM.deleted_at IS NULL AND user_master.active AND user_master.deleted_at IS NULL
                  )
                  UNION
                  (
                    SELECT
                      A.id AS post_id,
                      CONCAT('photo_',A.id) as unique_id,
                      A.user_id,
                      A.album_name AS title,
                      P.description,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb300x300}',P.s3key)  SEPARATOR ',') as thumb300x300,
                      GROUP_CONCAT(CONCAT('${s3Url+s3thumb1000x1000}',P.s3key)  SEPARATOR ',') as thumb1000x1000,
                      P.photo_url AS thumb,
                      GROUP_CONCAT(P.photo_url SEPARATOR ',') AS photo_urls,
                      CONCAT( U.first_name, ' ', U.last_name ) AS user_name,
                      ( SELECT COUNT(DISTINCT PM.id) FROM photo_master PM WHERE PM.album_id = A.id ) AS image_count,
                      CONCAT('${s3Url}',U.profile_image) as profile_image,
                      "photo" AS type,
                      IF (A.user_id = '${body.user_id}', "Y", "N") AS is_my_feed,
                      ( SELECT count(*) FROM photo_view_log PVL WHERE PVL.photo_id = P.id AND unique_view = 'Y' ) AS view_count,
                      A.created_at,
                      P.group_id
                    FROM
                      photo_master P
                    LEFT JOIN album_master A ON A.id = P.album_id
                    LEFT JOIN user_master U ON U.id = A.user_id
                    WHERE ISNULL(P.deleted_at) AND ISNULL(A.deleted_at)
                    GROUP BY A.id
                  )
                ) AS D
            WHERE 1  `;
    }

    if (body.group_id > 0 && body.group_id != undefined) {
      sql += `AND D.group_id ='${body.group_id}'`; ///
    } else if (body.profile_id && body.profile_id != undefined) {
      sql += `AND D.user_id = ${body.profile_id}
            OR D.user_id IN(
              SELECT  
                IF(following_master.user_id = ${
        body.profile_id
        }, following_master.follower_id, following_master.user_id) 
                FROM  following_master  
                WHERE user_id = ${body.profile_id} OR follower_id = ${body.profile_id}
            ) `;
    } else {
      sql += `AND D.user_id = ${body.user_id}
            OR D.user_id IN(
              SELECT  
                IF(following_master.user_id = ${
        body.user_id
        }, following_master.follower_id, following_master.user_id) 
                FROM  following_master  
                WHERE user_id = ${body.user_id} OR follower_id = ${body.user_id}
            ) `;
    }

    sql += ` ORDER BY D.created_at DESC`;

    // if (body.search)
    //   sql = `${sql} WHERE (D.title LIKE '%${body.search}%' OR D.description LIKE '%${body.search}%')`;
    // if (body.search && body.type) sql = `${sql} AND`;
    // if (!body.search && body.type) sql = `${sql} WHERE`;
    // if (body.type) {
    //   sql = `${sql} D.type='${body.type}'`;
    // }

    // sql = `${sql} ORDER BY
    // D.created_at DESC`;

    if (body.offset != undefined && body.limit) {
      sql = `${sql} LIMIT ${body.offset}, ${body.limit}`;
    }

 console.log(sql)

    return functions.selectQuery(sql);
  },

  createGroup(params) {
    return new Promise((resolve, reject) => {
      if (!params.group_id) {
        const data = {
          user_id: params.user_id,
          group_name: params.group_name,
          created_at: params.created_at,
          description: params.description,
          image: params.image,
          type: "normal"
        };
        functions
          .insert("group_master", data)
          .then(result => {
            params.group_id = result.insertId;
            resolve(params);
          })
          .catch(err => {
           
            reject("GROUP creation failed");
          });
      } else {
        resolve(params);
      }
    });
  },

  getGroupList(params) {
    params.limit = params.limit && params.limit != undefined ? params.limit : config.limit;
    params.offset = params.offset != undefined && params.offset ? (params.offset - 1) * params.limit : 0;
    let sql = `SELECT
                group_name,
                description,
                user_id,
                group_id,
                image,
                (SELECT count(group_members.group_member_id) FROM group_members WHERE group_members.group_id = group_master.group_id) as member_count,
                created_at
              FROM
                group_master`;
    if (params.search_key != undefined && params.search_key != "") {
      sql = `${sql} WHERE
      group_name LIKE  '%${params.search_key}%'`;
    }

    sql = `${sql} ORDER BY group_name ASC`;
   

    if (params.offset != undefined && params.limit) {
      sql = `${sql} LIMIT ${params.offset}, ${params.limit}`;
    }
    return functions.selectQuery(sql);
  },
  getGroupMembers(params) {

    let sql = `SELECT * FROM group_members WHERE user_id = ${params.user_id} AND group_id = ${params.group_id}`;
    return functions.selectQuery(sql);
  },
  userFollowUnfollow(params) {

    let sql = `SELECT * FROM following_master WHERE user_id = ${params.user_id} AND follower_id = ${params.follower_id}`;
    return functions.selectQuery(sql);
  },
  getChatList(params) {

    let sql = `SELECT
    group_members.user_id,
    group_members.group_id,
    group_master.group_name,
    group_master.image,
    (
      SELECT
        message
      FROM
        message_master
      WHERE
        group_id = group_members.group_id
      ORDER BY
        created_at DESC
      LIMIT 1
    ) AS last_message
  FROM
    group_members
  LEFT JOIN group_master ON group_master.group_id = group_members.group_id
  WHERE
    group_members.user_id = ${params.user_id}`;
    return functions.selectQuery(sql);
  },
  getChatDetails(params) {

    params.offset = params.offset && params.offset != undefined ? (params.offset - 1) * 10 : 0;
    let limit = params.limit;
    let sql = `SELECT
                message
                ,message_id
                ,IF(message_master.user_id = ${params.user_id}, 'Y', 'N') as is_my_message
                ,IF(DATE(message_master.created_at)=DATE(NOW()),DATE_FORMAT(message_master.created_at,'%h:%i:%p'),DATE_FORMAT(message_master.created_at,'%b %d, %Y %h:%i:%p')) as date_in_format
                ,message_master.created_at date
                ,CONCAT('${s3Url}',user_master.profile_image) as image
                ,CONCAT(user_master.first_name, " ", user_master.last_name) as name
              FROM
                message_master
              LEFT JOIN user_master ON user_master.id = message_master.user_id
              WHERE group_id = ${params.group_id} ORDER BY message_id DESC LIMIT ${params.offset}, ${limit}`;
    return functions.selectQuery(sql);
  },

  getSingleChatDetails(params) {

    let sql = `SELECT
                message
              ,message_id
              ,group_id
              ,message_master.user_id
              ,IF(DATE(message_master.created_at)=DATE(NOW()),DATE_FORMAT(message_master.created_at,'%h:%i:%p'),DATE_FORMAT(message_master.created_at,'%b %d, %Y %h:%i:%p')) as date_in_format
              ,message_master.created_at date
              ,CONCAT(user_master.first_name, ' ' , user_master.last_name) name
              ,CONCAT('${s3Url}',user_master.profile_image) as image
              FROM
                message_master
              LEFT JOIN user_master ON user_master.id = message_master.user_id
              WHERE
                message_id = ${params.message_id}`;
    return functions.selectQuery(sql);
  },


  getGroupMembersListNew(params) {
    params.limit = params.limit && params.limit != undefined ? params.limit : config.limit;
    params.offset = params.offset != undefined && params.offset ? (params.offset - 1) * params.limit : 0;
    let sql = `SELECT
                group_members.user_id,
                user_master.first_name,
                user_master.last_name,
                CONCAT('${s3Url}',user_master.profile_image) as image,
                DATE_FORMAT(group_members.created_at,"%d %b %Y") AS joined_date,`
                if(params.user_id != undefined){             
                  sql = `${sql} IF (following_master.id > 0,'Y','N') is_following,`
                }
                sql = `${sql} is_admin
                      FROM
                      group_members
                     INNER JOIN user_master ON user_master.id = group_members.user_id`
             if(params.user_id != undefined){
                sql = `${sql} LEFT JOIN following_master ON follower_id = user_master.id
                AND following_master.user_id = '${params.user_id}'`
             }
             
              sql = `${sql} WHERE
                group_members.group_id ='${params.group_id}'
                AND is_removed!='Y'
              GROUP BY
                user_master.id `;


    if (params.offset != undefined && params.limit) {
      sql = `${sql} LIMIT ${params.offset}, ${params.limit}`;
    }
    return functions.selectQuery(sql);
  },

  getGroupMembersList(params) {
    params.limit = params.limit && params.limit != undefined ? params.limit : config.limit;
    params.offset = params.offset != undefined && params.offset ? (params.offset - 1) * params.limit : 0;
    let sql = `SELECT
                group_members.user_id,
                user_master.first_name,
                user_master.last_name,
                user_master.image,
                DATE_FORMAT(group_members.created_at,"%d %b %Y") AS joined_date,              
              IF (following_master.id > 0,'Y','N') is_following,
              is_admin
              FROM
                group_members
              INNER JOIN user_master ON user_master.id = group_members.user_id
              LEFT JOIN following_master ON follower_id = user_master.id
               AND following_master.user_id = '${params.user_id}'
              WHERE
                group_members.group_id ='${params.group_id}'
                AND is_removed!='Y'
              GROUP BY
                user_master.id `;


    if (params.offset != undefined && params.limit) {
      sql = `${sql} LIMIT ${params.offset}, ${params.limit}`;
    }
    return functions.selectQuery(sql);
  },


  getGroupDetailsNew(params) {

    let sql = `SELECT group_master.*`
            
           if(params.user_id != undefined){
              sql =`${sql} ,IF(group_members.group_member_id > 0 ,'Y','N') AS is_joined
                ,IF(group_members.is_admin = 'Y' ,'Y','N') AS is_admin`  
           }
            
             
         sql = `${sql} ,COUNT(total_group_members.group_member_id) as members_count 
          FROM group_master`
          if(params.user_id != undefined){    
            sql = `${sql} LEFT JOIN group_members ON group_members.group_id = group_master.group_id AND group_members.user_id = '${params.user_id}' `
          }

         sql = `${sql} LEFT JOIN group_members total_group_members ON total_group_members.group_id = group_master.group_id    
          WHERE group_master.group_id = '${params.group_id}' and deleted_at is null         
          GROUP BY group_master.group_id `;
    return functions.selectQuery(sql);
  },

  getGroupDetails(params) {

    let sql = `SELECT group_master.*
               ,IF(group_members.group_member_id > 0 ,'Y','N') AS is_joined
                ,IF(group_members.is_admin = 'Y' ,'Y','N') AS is_admin 
                ,COUNT(total_group_members.group_member_id) as members_count 
                FROM group_master
                LEFT JOIN group_members ON group_members.group_id = group_master.group_id AND group_members.user_id = '${params.user_id}' 
               LEFT JOIN group_members total_group_members ON total_group_members.group_id = group_master.group_id    
              WHERE group_master.group_id = '${params.group_id}' and deleted_at is null         
             GROUP BY group_master.group_id `;
    return functions.selectQuery(sql);
  },

  oneToOneChat(params) {
    let sql = `SELECT group_id FROM group_master 
    WHERE (user_id = '${params.user_id}'  
    AND 
    friend_id = '${params.friend_id}') 
    OR 
    (user_id='${params.friend_id}' 
    and 
    friend_id='${params.user_id}')`;
    
    return functions.selectQuery(sql);
  },
  followUsers(params) {
    let sql = `SELECT * FROM following_master WHERE user_id=${params.user_id} AND follower_id=${params.follower_id}`;
    return functions.selectQuery(sql);
  },
  getFollowList(params) {
    let sql
    if (params.type == "followers") {
      sql = `SELECT 
      user_master.id,
      concat(user_master.first_name, ' '  ,user_master.last_name) user_name,
      CONCAT('${s3Url}',user_master.profile_image) image
      FROM following_master 
      LEFT JOIN user_master on user_master.id = following_master.user_id
      WHERE follower_id = ${params.user_id} `
    }
    else {
      sql = `SELECT 
      user_master.id,
      concat(user_master.first_name, ' '  ,user_master.last_name) user_name,
      CONCAT('${s3Url}',user_master.profile_image) image
      FROM following_master 
      LEFT JOIN user_master on user_master.id = following_master.follower_id
      WHERE user_id = ${params.user_id} `
    }
    
    return functions.selectQuery(sql);
  },
  isThisVideoOwnerMyfollowing({ video_id, user_id }) {
    sql = `SELECT IF(B.active IS NULL , 'N' , B.active ) ismyfollowing FROM video_master A
    LEFT JOIN following_master B ON A.user_id = B.follower_id AND B.user_id = ${user_id} WHERE A.id = ${video_id}`
    return functions.selectQuery(sql);
  },
  isThisAlbumOwnerMyfollowing({ album_id, user_id }) {
    sql = `SELECT  IF(B.active IS NULL , 'N' , B.active ) ismyfollowing FROM album_master A
    LEFT JOIN following_master B ON A.user_id = B.follower_id AND B.user_id = ${user_id} WHERE A.id = ${album_id}`
    return functions.selectQuery(sql);
  },
  getUsers({ search , limit , offset , self }) {
    let sql = `select 
      id as profile_id,
      concat(first_name, " ", last_name) user_name,
      CONCAT('${s3Url}', profile_image) as image,
      total_point,
      email
     from user_master WHERE ISNULL(deleted_at) `
     
     if(typeof search === "string" && search.length > 3){
      sql += ` AND (first_name regexp "${search.map((item, index) => `^${item}${search.length - 1 != index ? "|" : ""}`)}" 
       or last_name regexp "${search.map((item, index) => `^${item}${search.length - 1 != index ? "|" : ""}`)}") `
       
     }

     if(self){

     sql += ` AND user_master.id != ${self}`
     }
    
    if(typeof limit == 'number' && typeof offset == "number" ) {
      sql += ` LIMIT ${limit*offset},${limit}` 
    }
    console.log(sql)
    return functions.selectQuery(sql);
  },
  getImageAd() {
    sql=`select * from photo_advertisement_master where active='Y' and deleted_at is null and no_of_clicks<allowed_clicks order by rand() limit 2`
    return functions.selectQuery(sql);
  },
  addImpression(body){
    
    if (body) return functions.insert("photo_ad_log", body);
    else
      return new Promise((resolve, reject) => {
        reject("Invalid Request.");
      });
  },
  incrementImpressionCount(ad_id){
     sql = `UPDATE photo_advertisement_master SET no_of_impression = no_of_impression + 1 WHERE id =`+ ad_id;
    
     return functions.selectQuery(sql);

  },
  getGroupCount(user={}) {
    sql = 
    `SELECT count(GM.group_id) as count
                 
              FROM group_master GM 
              LEFT JOIN user_master UM ON UM.id = GM.user_id`;
    if (user.user_id != undefined && user.user_id) {
      sql = `${sql} WHERE GM.group_id IN(SELECT group_id FROM group_members GM WHERE GM.user_id = ${user.user_id})`;
    }
    sql = `${sql} AND type = 'normal' 
              AND GM.deleted_at IS NULL`;

           
   
    return functions.selectQuery(sql);
   
  },
  getSubscribedCount(user={}){
    let sql = `SELECT
              count(video_master.id) as count
              FROM video_master
              INNER JOIN user_master ON video_master.user_id = user_master.id
              LEFT JOIN category_master ON category_master.category_id = video_master.category_id
              LEFT JOIN following_master ON following_master.user_id = video_master.user_id
              WHERE (video_master.active = 'Y' AND video_master.deleted_at IS NULL AND user_master.active = 'Y' AND user_master.deleted_at IS NULL AND following_master.follower_id =  ${user.user_id} )`;

    
    return functions.selectQuery(sql);
  },
  getUnreadChatNotification({user_id}) {
    const sql = `SELECT A.group_id,
    COUNT(*) un_read_message_count,
    max(A.message_id) latest_message_id,
    (SELECT message FROM message_master WHERE message_id = max(A.message_id)) as message 
    FROM message_master A
    LEFT JOIN message_read_master B on A.group_id = B.group_id
    WHERE B.member_id = ${user_id} and A.user_id!= ${user_id}  and A.message_id > B.last_read_message_id GROUP BY A.group_id`
    return functions.selectQuery(sql);
  },
  getMyChatList({user_id , limit , offset , search}) {  
    let sql = `SELECT * from (SELECT
      A.group_id,
      A.group_name,
      A.description,
      A.image group_image,
      A.type,
      (SELECT T1.created_at FROM message_master T1 WHERE T1.message_id = MAX(B.message_id)) as last_message_time,
      (SELECT T1.message FROM message_master T1 WHERE T1.message_id = MAX(B.message_id)) as last_message,
      (SELECT COUNT(*) as un_read_message_count FROM message_master T2 WHERE T2.group_id = A.group_id and T2.message_id > ( SELECT last_read_message_id as message_id FROM message_read_master WHERE member_id = ${user_id} and group_id = A.group_id  ) )  as un_read_message_count,
      MAX(B.message_id) as message_id,
      C.id friend_id,
      CONCAT(C.first_name , ' ' , C.last_name) friend_name,
      CONCAT('${s3Url}',C.profile_image) as friend_image
      FROM group_master A
      LEFT JOIN group_members D ON D.group_id = A.group_id
            LEFT JOIN message_master B ON A.group_id = B.group_id
      LEFT JOIN user_master C ON IF(A.friend_id = ${user_id} , A.user_id = C.id , A.friend_id = C.id)
      where (A.user_id = ${user_id} OR A.friend_id= ${user_id} OR D.user_id = ${user_id}) `  
      
      if(search){
        sql += ` AND (C.first_name like '%${search}%'  OR C.last_name like '%${search}%' OR A.group_name like '%${search}%') `
      }

      sql += ` GROUP BY A.group_id ) as Q1 ORDER BY Q1.last_message_time DESC`

      if(typeof limit == 'number' && typeof offset == "number" ) {
        sql += ` LIMIT ${limit*offset},${limit}` 
      }
      return functions.selectQuery(sql);
  },
  getChatGroupDetails({group_id,user_id}) {    
    const sql =`SELECT 
    A.group_id,
    A.group_name,
    A.description,
    CONCAT(B.first_name , ' ' , B.last_name) friend_name,
    B.id friend_id,
    A.image group_image,
    CONCAT('${s3Url}',B.profile_image) as friend_image
    from 
    group_master A
    LEFT JOIN user_master B ON IF(A.friend_id = ${user_id} , A.user_id = B.id , A.friend_id = B.id) WHERE A.group_id = ${group_id}`
    return functions.selectQuery(sql);
  },
  getGroups({search,limit,offset}) {
    let sql = `SELECT GM.group_id,
    GM.user_id as user_id,
        GM.group_name,
        GM.description,
        GM.image as group_image,
        DATE_FORMAT(GM.created_at, '%Y-%m-%d %H:%i:%s') as datee,
        CONCAT(UM.first_name, ' ', UM.last_name) as user_name,
        UM.image as profile_image,
        (SELECT COUNT(VM.id)  FROM video_master VM WHERE VM.group_id =  GM.group_id AND VM.active="Y" ) video_post_count,
        (SELECT COUNT(AM.id)  FROM album_master AM LEFT JOIN photo_master PM ON PM.album_id = AM.id  WHERE PM.group_id =  GM.group_id AND AM.active="Y" ) album_post_count,
      (SELECT COUNT(group_member_id) FROM group_members WHERE group_id = GM.group_id) as member_count
FROM group_master GM 
LEFT JOIN user_master UM ON UM.id = GM.user_id WHERE  type = 'normal' 
AND GM.deleted_at IS NULL AND GM.group_name LIKE '%${search}%'`

if(typeof limit == 'number' && typeof offset == "number" ) {
  sql += ` LIMIT ${limit*offset},${limit}` 
}
  return functions.selectQuery(sql);
  },
  getUserDetail({user_id}) {
    const sql = `SELECT 
  	A.id,
    A.unique_id,
    A.email,
    A.user_type,
    A.first_name,
    A.last_name,
    A.image,
    CONCAT('${s3Url}',A.profile_image) as profile_image,
    A.city,
    A.state_id,
    A.my_dream,
    A.zip_code,
    A.country_id,
    A.dob,
    A.facebook_token,
    A.google_token,
    A.stripe_id,
    A.active,
    A.total_point, 
    A.last_login,
    A.created_at,
    A.updated_at,
    A.deleted_at,
    A.email_verified,
    IF(B.is_unsubscribed = 1 , 'Y' ,'N' ) newsletter_subcribed
    FROM user_master A
    LEFT JOIN subscription_master B ON A.email = B.email_id
    WHERE A.id=${user_id}
    `
    return functions.selectQuery(sql);
  },
  getOldestMember({group_id}) {
    const sql = `SELECT B.group_member_id from group_members B WHERE B.group_id = ${group_id} order by B.group_member_id asc limit 1`
    return functions.selectQuery(sql);
  },
  // addOrUpdateReaction({ reaction_type, user_id, video_id , album_id }) {
  //   const sql = `INSERT INTO reaction_master (${video_id ? 'video_id' : 'album_id' },reaction_type,user_id) VALUES (${video_id ? video_id : album_id },"${reaction_type}",${user_id})
  //   ON DUPLICATE KEY UPDATE reaction_type="${reaction_type}" `
  //   return functions.selectQuery(sql);
  // },
  getWebsiteBanners(){
    const sql = `SELECT id, banner_title, banner_text, photo_url, active, created_at, updated_at, deleted_at
FROM banner_master where active = 'Y' and deleted_at is null;`

    return functions.selectQuery(sql);
  },
  getUserSubscribed(user={}){
    user.limit = user.limit && user.limit != undefined ? user.limit : config.limit;
    user.offset = user.offset != undefined && user.offset ? (user.offset - 1) * user.limit : 0;
    let sql = `SELECT
    video_master.video_url as video_url,
    video_master.id as post_id,
    video_master.video_thumb as thumb,
    video_master.active as active,
    video_master.created_at as created_at,
    video_master.deleted_at as deleted_at,
    video_master.updated_at as updated_at,
    video_master.total_views as total_views,
    video_master.total_earning as total_earning,
    video_master.title as title,
    category_master.category_name AS category,
    user_master.unique_id AS user_unique_id,
    video_master.user_id as post_user_id,
    user_master.first_name,
    user_master.last_name,
    CONCAT('${s3Url}',user_master.profile_image) as profile_image
  FROM video_master
  LEFT JOIN user_master ON video_master.user_id = user_master.id
  LEFT JOIN category_master ON category_master.category_id = video_master.category_id
  LEFT JOIN following_master ON following_master.follower_id = video_master.user_id
  WHERE (video_master.active = 'Y' AND video_master.deleted_at IS NULL AND user_master.active = 'Y' AND user_master.deleted_at IS NULL AND following_master.user_id =  ${user.user_id} )`

  if (user.search)
      sql = `${sql} AND (video_master.title LIKE '%${
        user.search
        }%' OR video_master.description LIKE '%${user.search}%')`;

    if (user.sort)
      switch (user.sort) {
        case "recent":
          sql = `${sql} ORDER BY video_master.created_at DESC`;
          break;
        case "top_grossing":
          sql = `${sql} ORDER BY video_master.total_earning DESC`;
          break;
        case "most_popular":
          sql = `${sql} ORDER BY video_master.total_views DESC`;
          break;
      }

    if (user.offset != undefined && user.limit)
      sql = `${sql} LIMIT ${user.offset}, ${user.limit}`;

    
        

    return functions.selectQuery(sql);


  },
  getMyPoints(params) {
    
    const { limit , offset } = params

    let sql = `
    SELECT  
    A.id,
    IF(A.item_type = 'reaction',F.reaction_type,A.item_type) as item_type,
    A.item_id,
    G.scenario,
    A.file_id,
    A.file_type,
    point,
    A.id as point_id,
    E.comment as comment,
    CASE 
    	WHEN A.item_type = "comment" THEN CONCAT(CONCAT(RUM.first_name , ' ' , RUM.last_name)   , " commented on " , IF(A.file_type = "video" , VF.title  , AF.album_name ) )
    	WHEN A.item_type = "reaction" THEN CONCAT(CONCAT(RUM.first_name , ' ' , RUM.last_name)   , IF(F.reaction_type = 'like' , " liked " , " disliked ") , IF(A.file_type = "video" , VF.title  , AF.album_name ) )
		WHEN (A.item_type = "video" OR A.item_type = "album") THEN CONCAT(CONCAT(PUM.first_name , ' ' , PUM.last_name) , " posted " , IF(A.file_type = "video" , VF.title  , AF.album_name )  )
	END as reason,
    A.created_at,
    IF(A.file_type = "video" , VF.title  , AF.album_name ) file_title,
    IF(A.file_type = "video" , VF.video_thumb  , (SELECT PM1.photo_url FROM photo_master PM1 WHERE PM1.album_id = A.file_id LIMIT 1  ) ) file_thumb
    FROM  point_master A 
    LEFT JOIN video_master VF on  A.file_id = VF.id and A.file_type = "video"
    LEFT JOIN album_master AF on  A.file_id = AF.id and A.file_type = "album"
    LEFT JOIN comment_master E on  A.item_id = E.comment_id and A.item_type = "comment"
    LEFT JOIN reaction_master F on  A.item_id = F.reaction_id and A.item_type = "reaction"
    LEFT JOIN user_master RUM on RUM.id = F.user_id
    LEFT JOIN user_master PUM on PUM.id = VF.user_id OR PUM.id = AF.user_id 
    LEFT JOIN points_coins G on G.id = A.scenario_id    
WHERE A.user_id = ${params.user_id} ORDER BY A.id DESC`

    if(limit && offset) {

      sql += ` LIMIT ${offset},${limit}`

    }

    return functions.selectQuery(sql);
  },
  getMyTotalPoint(params){
            const sql = `
            SELECT 
            SUM(point) as total_points
            FROM  point_master A 
            WHERE A.user_id = ${params.user_id}
    `
    console.log(sql);
    return functions.selectQuery(sql);
  },
  getMyCoins(params) {
    
    const { limit , offset } = params
    
    let sql = `
    SELECT A.id coin_id,
    A.file_id,
    A.file_type,
    A.coin,
    IF(A.file_type = "video" , VF.title  , AF.album_name ) file_title,
    IF(A.file_type = "video" , VF.video_thumb  , (SELECT PM1.photo_url FROM photo_master PM1 WHERE PM1.album_id = AF.id LIMIT 1  ) ) file_thumb,
    A.created_at
    FROM  coin_master A 
    LEFT JOIN video_master VF ON A.file_type = "video" AND VF.id = A.file_id
    LEFT JOIN album_master AF ON A.file_type = "album" AND VF.id = A.file_id
    WHERE A.user_id = ${params.user_id} `

    if(limit && offset) {

      sql += ` LIMIT ${offset},${limit}`

    } 
    console.log(sql)
    return functions.selectQuery(sql);
  },
  getMyTotalCoins(params){
    const sql = `
    SELECT sum(coin) count
    FROM  coin_master A 
    WHERE A.user_id = ${params.user_id}
  `
    return functions.selectQuery(sql);
  },
  getTodayCoin(params) {
    const { 
      item_id,
      item_type,
      coin,
      user_id,
      scenario_id,
      ip_address,
      file_id,
      file_type
     } = params

         const sql = `
        SELECT id, item_id, item_type, user_id, coin, file_type, file_id, scenario_id, ip_address, created_at
        FROM coin_master WHERE item_id =${item_id} AND item_type="${item_type}" AND user_id = ${user_id} AND created_at >= NOW() - INTERVAL 1 DAY;
        `
    return functions.selectQuery(sql);
  },
  getOneToOneGroup(params) {
    const sql = `SELECT * FROM group_master WHERE (user_id = ${params.user_id} AND friend_id = ${params.friend_id}) OR (user_id = ${params.friend_id} AND friend_id = ${params.user_id} );`
    
    return functions.selectQuery(sql);
}

};

module.exports = postModel;
