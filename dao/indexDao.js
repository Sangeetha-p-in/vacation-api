let functions = require("../helpers/functions"),
    mysql = require("mysql"),
    moment = require("moment");

let indexModel = {};

indexModel.getCategories = function () {
    let sql = `SELECT * FROM category_master WHERE active = 'Y'`;
    return functions.selectQuery(sql);
};

indexModel.getConfig = (params) => {
    let sql = `SELECT * FROM general_config WHERE`;
    if (typeof params === "string") {
        sql = `${sql} field = "${params}"`;
    } else if (Array.isArray(params)) {
        params.forEach(c => {
            sql = `${sql} field = "${c}" OR`;
        });
        sql = sql.slice(0, -3);
    }
    return functions.selectQuery(sql);
};

indexModel.addUserNotification = (params) => {
    let data = {
        notification_item_type : params.notification_item_type,
        notification_item_id : params.notification_item_id,
        file_id: params.file_id,
        file_type: params.file_type,
        user_id : params.user_id
    } ;
    return functions.insert('notification_master', data);
};

indexModel.getUsersDetailsForNotification = (idList) => {
    if (idList.length) {
        let sql = `SELECT U.id, U.first_name, U.last_name, U.image, U.push_object FROM user_master U WHERE U.deleted_at IS NULL AND (`;
        idList.forEach(user_id => {
            sql += ` U.id = ${user_id} OR`
        });
        sql = sql.slice(0, sql.length - 2);
        sql += `)`;
        return functions.selectQuery(sql);
    }

};

// indexModel.getUserNotificationUnreadCount = (params) => {
//     let sql = ` SELECT COUNT(*) as count  FROM notification_master WHERE FIND_IN_SET(${params.user_id}, user_id)>0
//     AND ( FIND_IN_SET(${params.user_id},read_users_id) = 0 OR read_users_id IS NULL) AND deleted_at IS NULL`;
//     return functions.selectQuery(sql);
// };

indexModel.getUserNotificationUnreadCount = (params) => {

    const { user_id, bw_day } = params 

    let sql =`SELECT COUNT(*) as count
	FROM notification_master A
    LEFT JOIN video_master VF ON (VF.id = A.file_id AND A.file_type = "video")
    LEFT JOIN album_master AF ON (AF.id = A.file_id AND A.file_type = "album")
    LEFT JOIN reaction_master RM ON RM.reaction_id = A.notification_item_id AND A.notification_item_type = "reaction"
    LEFT JOIN user_master RUM ON RUM.id = RM.user_id AND A.notification_item_type = "reaction"
    LEFT JOIN comment_master CM ON CM.comment_id = A.notification_item_id AND A.notification_item_type = "comment"
    LEFT JOIN user_master CUM ON CUM.id = CM.user_id AND A.notification_item_type = "comment"
    LEFT JOIN user_master FILE_OWNER ON FILE_OWNER.id = ( CASE 
    	WHEN A.file_type = "video" THEN VF.user_id  
    	WHEN A.file_type = "photo" THEN (SELECT PM1.user_id FROM photo_master PM1 WHERE PM1.id = A.file_id LIMIT 1)
    	WHEN A.file_type = "album" THEN (SELECT AM1.user_id FROM album_master AM1 WHERE AM1.id = A.file_id LIMIT 1)
    	ELSE '' END )
    WHERE 
	FIND_IN_SET(${params.user_id}, A.user_id)>0
    AND ( FIND_IN_SET(${params.user_id}, A.read_users_id) = 0 OR A.read_users_id IS NULL) 
    AND ((ISNULL(FILE_OWNER.deleted_at) AND FILE_OWNER.active="Y") OR ISNULL (FILE_OWNER.id)) AND  FIND_IN_SET(213,A.user_id) 
                 AND VF.deleted_at IS NULL AND  AF.deleted_at IS NULL AND A.created_at > DATE_SUB(CURDATE(), INTERVAL 14 day)
`
if(bw_day){
    sql += ` AND A.created_at > DATE_SUB(CURDATE(), INTERVAL ${bw_day} day)`
}
else{
    sql += ` AND A.created_at > DATE_SUB(CURDATE(), INTERVAL 14 day)`
}
console.log(sql)

return functions.selectQuery(sql);
}

indexModel.getUserNotification = (params) => {
    
    const { user_id, bw_day } = params 

    let sql = `    SELECT
    A.id,
    A.notification_item_id, 
    IF(A.file_type="photo","album",A.file_type) file_type,
    IF(A.file_type="photo",(SELECT PM1.album_id FROM photo_master PM1 WHERE PM1.id = A.file_id ) , A.file_id) file_id, 
    A.notification_item_type,
    A.notification_item_id,
    A.created_at,
    FILE_OWNER.id file_owner,
    IF(FIND_IN_SET(${user_id},A.read_users_id) > 0, TRUE, FALSE) AS read_status,
    CASE 
		WHEN A.file_type="video" THEN VF.title  
		WHEN A.file_type="album" THEN AF.album_name
		WHEN A.file_type="photo" THEN (SELECT PM3.title FROM photo_master PM3 WHERE PM3.id = A.file_id)
	END as file_title,
    CASE 
    	WHEN A.file_type="video" THEN VF.video_thumb
    	WHEN A.file_type="album" THEN (SELECT PM1.photo_url FROM photo_master PM1 WHERE PM1.album_id = A.file_id LIMIT 1 )
        WHEN A.file_type="photo" THEN (SELECT PM2.photo_url FROM photo_master PM2 WHERE PM2.id = A.file_id LIMIT 1 )
        WHEN A.notification_item_type = "admin_message" THEN A.image_url
	END AS file_thumb,
    CASE 
        WHEN A.notification_item_type = "admin_message" THEN A.message
    	WHEN  A.notification_item_type = "reaction"  THEN CONCAT(RUM.first_name,' ' , RUM.last_name , ' ' , IF(RM.reaction_type="like" , "liked" , "disliked") , ' ' , IF(A.file_type="video" , VF.title , AF.album_name ) )  
    	WHEN  A.notification_item_type = "comment"  THEN CONCAT(CUM.first_name,' ' , CUM.last_name , ' ' , 'commented' , ' on ' , 
    		CASE 
    			WHEN  A.file_type="video" THEN VF.title
    			WHEN  A.file_type="album" THEN AF.album_name
    			WHEN  A.file_type="photo" THEN (SELECT PM3.title FROM photo_master PM3 WHERE PM3.id = A.file_id)
			END
        )
        WHEN  A.notification_item_type  IN("admin_disapproval","admin_approval")  THEN CONCAT( IF(A.notification_item_type="admin_approval" , "Admin approved your post " , "Admin disapproved your post ") ,     		
            CASE 
    			WHEN  A.file_type="video" THEN VF.title
    			WHEN  A.file_type="album" THEN AF.album_name
			END )    
		ELSE "new notification"
	END as message
	FROM notification_master A
    LEFT JOIN video_master VF ON (VF.id = A.file_id AND A.file_type = "video")
    LEFT JOIN album_master AF ON (AF.id = A.file_id AND A.file_type = "album")
    LEFT JOIN reaction_master RM ON RM.reaction_id = A.notification_item_id AND A.notification_item_type = "reaction"
    LEFT JOIN user_master RUM ON RUM.id = RM.user_id AND A.notification_item_type = "reaction"
    LEFT JOIN comment_master CM ON CM.comment_id = A.notification_item_id AND A.notification_item_type = "comment"
    LEFT JOIN user_master CUM ON CUM.id = CM.user_id AND A.notification_item_type = "comment"
    LEFT JOIN user_master FILE_OWNER ON FILE_OWNER.id = ( CASE 
    	WHEN A.file_type = "video" THEN VF.user_id  
    	WHEN A.file_type = "photo" THEN (SELECT PM1.user_id FROM photo_master PM1 WHERE PM1.id = A.file_id LIMIT 1)
    	WHEN A.file_type = "album" THEN (SELECT AM1.user_id FROM album_master AM1 WHERE AM1.id = A.file_id LIMIT 1)
    	ELSE '' END )
    WHERE ((ISNULL(FILE_OWNER.deleted_at) AND FILE_OWNER.active="Y") OR ISNULL (FILE_OWNER.id))  
                AND FIND_IN_SET(${user_id},A.user_id) 
                 AND VF.deleted_at IS NULL AND  AF.deleted_at IS NULL`
    
    if(bw_day){
        sql += ` AND A.created_at > DATE_SUB(CURDATE(), INTERVAL ${bw_day} day)`
    }
    else{
        sql += ` AND A.created_at > DATE_SUB(CURDATE(), INTERVAL 14 day)`
    }

    sql += ` ORDER BY A.created_at DESC`
    console.log(sql)
    return functions.selectQuery(sql);
};

indexModel.readNotification = (params) => {
    let sql = `UPDATE notification_master N1
            LEFT JOIN notification_master N2 ON N1.id = N2.id
            SET N1.read_users_id = IF(N2.read_users_id IS NULL, ${
        params.user_id
        }, CONCAT(N2.read_users_id,',',${params.user_id}))
            WHERE N1.id = ${params.notification_id} AND (FIND_IN_SET(${params.user_id},N1.read_users_id) = 0 OR N1.read_users_id IS NULL)`;
    return functions.processQuery(sql, {});
};

indexModel.deleteNotification = params => {
    let sql = `UPDATE notification_master N1
            LEFT JOIN notification_master N2 ON N1.id = N2.id
            SET N1.deleted_users_id = IF(N2.deleted_users_id = '', ${
        params.user_id
        }, CONCAT(N2.deleted_users_id,',',${params.user_id}))
            WHERE N1.id = ${params.notification_id}`;
            console.log(sql)
    return functions.processQuery(sql, {});
};

indexModel.subscribe = params => {
    return new Promise((resolve, reject) => {
        functions
            .get("subscription_master", { email_id: params.email_id })
            .then(response => {
                if (Array.isArray(response) && response.length) {
                    if (response[0].is_unsubscribed) {
                        resolve(
                            functions.update(
                                "subscription_master",
                                { is_unsubscribed: 0 },
                                { email_id: params.email_id }
                            )
                        );
                    } else {
                        reject(
                            "You subscription to VacationMe newsletter is already confirmed!"
                        );
                    }
                } else {
                    resolve(
                        functions.insert("subscription_master", {
                            email_id: params.email_id
                        })
                    );
                }
            })
            .catch(error => {
                reject(error);
            });
    });
};

indexModel.unsubscribe = params => {
    return new Promise((resolve, reject) => {
        functions
            .get("subscription_master", { email_id: params.email_id })
            .then(response => {
                if (Array.isArray(response) && response.length) {
                    if (response[0].is_unsubscribed) {
                        reject("You already unsubscribed from the service.");
                    } else {
                        resolve(
                            functions.update(
                                "subscription_master",
                                { is_unsubscribed: 1 },
                                { email_id: params.email_id }
                            )
                        );
                    }
                } else {
                    reject("No active subscription found!");
                }
            })
            .catch(error => {
                reject(error);
            });
    });
};

module.exports = indexModel;
