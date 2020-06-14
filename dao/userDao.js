let functions = require('../helpers/functions'),
    mysql = require('mysql');
const s3Url = "https://vacationbucket.s3.us-east-2.amazonaws.com/"
let userDao = {
    getUserByEmail(email = '') {

        let sql = `
            SELECT
                id as user_id
            FROM user_master 
            WHERE email = ${mysql.escape(email)} && ISNULL(deleted_at)`;
        return functions.selectQuery(sql);
    },
    getUserByUserName(user_name = '') {

        let sql = `
            SELECT
               *
            FROM user_master U
            WHERE email = ${mysql.escape(user_name)}  && ISNULL(deleted_at)`;


        return functions.selectQuery(sql);
    },

    getUserByFb(id = '') {
        let sql = `
        SELECT
           *
        FROM user_master U
        WHERE facebook_token = ${mysql.escape(id)} && ISNULL(deleted_at)`;

        return functions.selectQuery(sql);
    },
    getUserByGoogle(id = '') {
        let sql = `
        SELECT
           *
        FROM user_master U
        WHERE google_token = ${mysql.escape(id)} && ISNULL(deleted_at)`;

        return functions.selectQuery(sql);
    },

    getUserById(user_id = '') {
        let sql = `
            SELECT
               U.*,U.id as user_id,U.email,CONCAT('${s3Url}',U.profile_image) as profile_image,DATE_FORMAT(U.dob, "%m/%d/%Y") as dob,TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age, U.first_name as first_name, U.last_name as last_name
            FROM user_master U
            WHERE U.id = ${user_id}`;
        return functions.selectQuery(sql);
    },
    getPublicUserById(user_id = '', public_id = '') {
        sql = `SELECT
        U.*,
        state_master.state_name ,
        U.id as user_id,
        U.email,CONCAT('${s3Url}',U.profile_image) as profile_image,
        DATE_FORMAT(U.dob, "%m/%d/%Y") as dob,
        TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age, 
        U.first_name as first_name,`
        if(user_id != undefined){
            sql = `${sql} IF (following_master.id > 0,'Y','N') is_following,G.group_id one_to_one_chat_id,`
        } 
       
       
        
        sql = `${sql} U.last_name as last_name FROM user_master U`
        if(user_id != undefined){
            sql = `${sql} LEFT JOIN following_master ON follower_id = U.id AND following_master.user_id = ${user_id}
                     LEFT JOIN group_master G ON ((G.user_id = ${public_id} and G.friend_id = ${user_id}) OR (G.user_id = ${user_id} and G.friend_id = ${public_id}) ) `
        }
        
        sql = `${sql} LEFT JOIN state_master on state_master.id = U.state_id
                WHERE U.id = ${public_id}`
       
        
        console.log(sql)

        return functions.selectQuery(sql);
    },
    getUserByVerificationCode(reset_code = '') {

        let sql = `
            SELECT
                id as user_id
            FROM user_master 
            WHERE reset_code = ${mysql.escape(reset_code)}`;

        return functions.selectQuery(sql);
    },
    getUserOtps(user_id = '', otp_code = '') {

        let sql = `SELECT * FROM user_otps WHERE user_master_user_id=${user_id} AND otp_status='N' AND otp_code='${otp_code}' ORDER BY user_otps.create_time DESC LIMIT 1`;

        return functions.selectQuery(sql);
    },
    getUserDetails(user_id = '', usertype = '') {

        let table_name = (usertype == '2') ? 'customer_details' : 'business_details';

        let sql = `SELECT
                        user_details.*,
                        ${table_name}.*
                   FROM user_details
                   LEFT JOIN ${table_name}
                   ON user_details.usr_details_id = ${table_name}.user_details_usr_details_id
                   INNER JOIN user_master
                   ON user_master.user_id = user_details.user_master_user_id WHERE 1 `;

        if (usertype) sql += `AND user_master.user_types_type_id= ${usertype} `;

        if (user_id) sql += `AND user_details.user_master_user_id = ${user_id}`;

        return functions.selectQuery(sql);
    },
    checkEmail(user_id = '', email = '') {

        let sql = `
            SELECT
                id as user_id,first_name,last_name
            FROM user_master 
            WHERE email = ${mysql.escape(email)} AND id != ${user_id}`;

        return functions.selectQuery(sql);
    },
    checkUserName(user_id = '', user_name = '') {

        let sql = `
            SELECT
               id as user_id,email,password,first_name,last_name,user_type,CONCAT('${s3Url}',profile_image) as profile_image,IF(industry_id IS NULL,'',industry_id) AS industry,IF(about IS NULL,'',about) AS about
            FROM user_master
            WHERE user_name = ${mysql.escape(user_name)} AND id != ${user_id}`;

        return functions.selectQuery(sql);
    },
    /*     getUserProfile(user_id = '') {
    
            let sql = `
                SELECT
                   U.id as user_id,U.email,U.first_name,U.last_name,IF(U.image IS NULL,'default.png',U.image) AS profile_image,U.location,U.user_name
                FROM user_master U
                WHERE U.id = ${user_id}`;
    
            return functions.selectQuery(sql);
        }, */
    getPlayers(user_id = '', search_key = '', location = '', category_id = '') {
        let sql = `
            SELECT
               U.unique_id as user_id,U.full_name,U.country,CONCAT('${s3Url}',U.profile_image) as profile_image
            FROM user_master U
            WHERE U.id != ${user_id}`;
        if (search_key != '' && typeof search_key !== 'undefined') {
            sql += ` AND (U.full_name LIKE '%${search_key}%')`;
        }
        if (location != '' && typeof location !== 'undefined') {
            sql += ` AND (U.country LIKE '%${location}%')`;
        }
        // if(category_id!='' && typeof category_id !== 'undefined'){
        //    sql+=` AND (U.country LIKE '%${category_id}%')`;  
        // }

        return functions.selectQuery(sql);
    },
    getUserTeams(user_id = '', search_key = '', location = '', category_id = '') {
        let sql = `
            SELECT
               T.id as team_id,T.team_name,T.location,T.team_rank,IF(T.cover_image IS NULL,'default.png',T.cover_image) AS cover_image,IF(T.logo IS NULL,'default.png',T.logo) AS logo_image,C.title as category
            FROM team_master T
            LEFT JOIN sports_category C
                   ON T.category_id = C.id
            WHERE T.user_id = ${user_id}`;
        if (search_key != '' && typeof search_key !== 'undefined') {
            sql += ` AND (T.team_name LIKE '%${search_key}%')`;
        }
        if (location != '' && typeof location !== 'undefined') {
            sql += ` AND (T.location LIKE '%${location}%')`;
        }
        if (category_id != '' && typeof category_id !== 'undefined') {
            sql += ` AND (T.category_id LIKE '%${category_id}%')`;
        }
        console.log(sql);

        return functions.selectQuery(sql);
    },
    getUserId(userid = '') {
        let sql = `
            SELECT
               id as user_id
            FROM user_master 
           
            WHERE unique_id = '${userid}'`;

        return functions.selectQuery(sql);
    },
    getUserByProfile(user_id = '') {

        let sql = `
            SELECT
               U.id as user_id,U.user_name,U.full_name,U.email,CONCAT('${s3Url}',U.profile_image) as profile_image,U.phone,U.country,U.zip_code,DATE_FORMAT(U.dob, "%m/%d/%Y") as dob,TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age
            FROM user_master U
            WHERE U.id = ${user_id}`;

        return functions.selectQuery(sql);
    },
    getCategories(user_id = '') {
        let sql = `
            SELECT
               C.title,C.id
            FROM sports_category C where C.deleted_at IS NULL`;

        return functions.selectQuery(sql);
    },
    getTeamProfile(team_id = '') {
        let sql = `
             SELECT
               T.id as team_id,T.team_name,T.location,T.team_rank,IF(T.cover_image IS NULL,'default.png',T.cover_image) AS cover_image,IF(T.logo IS NULL,'default.png',T.logo) AS logo_image,C.title as category,T.description,T.win,T.lost,T.points,U.full_name as team_owner,CONCAT('${s3Url}',U.profile_image) as owner_image,U.country as owner_location
            FROM team_master T
            LEFT JOIN sports_category C
                   ON T.category_id = C.id
            LEFT JOIN user_master U
                   ON T.user_id = U.id
            WHERE T.id = ${team_id}`;

        return functions.selectQuery(sql);
    },
    getTeamMembers(team_id = '') {
        let sql = `
             SELECT
               U.id as user_id,CONCAT('${s3Url}',U.profile_image) as profile_image
            FROM team_members T
            LEFT JOIN user_master U
                   ON T.user_id = U.id
            WHERE T.team_id = ${team_id}`;

        return functions.selectQuery(sql);
    },
    getTeamMatches(team_id = '') {
        let sql = `
             SELECT * FROM
             team_match M
            WHERE M.team1 = ${team_id} OR M.team2 = ${team_id}`;

        return functions.selectQuery(sql);
    },
    getStates() {
        let sql = `
        SELECT * FROM
        state_master `;
        return functions.selectQuery(sql);
    },
    updatePushObject(params) {
        console.log('updatePushObject', params);
        return functions.update(
            'user_master',
            { push_object: params.push_object },
            { id: params.user_id }
        );
    },

    getUserPoints(user_id = '') {
        let sql = `
        select SUM(t.pointVal) totalPointBalance, SUM(t.point)  totalPoints, 800 as totalCoinBalance , 80 as totalCoins from (select  (PM.point * PC.point_value) pointVal , PM.point,PM.scenario_id,PM.user_id from point_master PM INNER JOIN points_coins PC ON PM.scenario_id=PC.id where PM.user_id=${user_id} ) t group by t.user_id` ;
        return functions.selectQuery(sql);
    },
}

module.exports = userDao;