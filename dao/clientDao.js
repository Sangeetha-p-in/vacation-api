let functions = require('../helpers/functions'),
    mysql = require('mysql');

let clientDao = {


    getImgesVideos(page = '',limit){
        var page = page ? page : 1;
        let start=parseInt(page)*parseInt(limit) -parseInt(limit);
        let sql = `
        select PV.*,U.first_name,U.last_name,U.image from ((select A.id,A.user_id,A.album_name as title,A.created_at,'' as description,'' as location,P.total_comments,P.photo_thumb as thumb,P.photo_url as url,'image' as type,IFNULL(total_views,0) AS total_views from album_master A JOIN (select * from photo_master GROUP BY album_id) P ON P.album_id=A.id)
        UNION  
        (SELECT id,user_id,title,created_at,description,location,total_comments,video_thumb as thumb,video_url as url,'video' as type,IFNULL(total_views,0) AS total_views from video_master)) PV JOIN user_master U ON U.id=PV.user_id ORDER BY PV.created_at desc LIMIT ${start},${limit}`;
        
        return functions.selectQuery(sql); 
    },
    getUserImgesVideos(user_id,page = '',limit){
        var page = page ? page : 1;
        let start=parseInt(page)*parseInt(limit) -parseInt(limit);
        let sql = `
        select PV.*,U.first_name,U.last_name,U.image from ((select A.id,A.user_id,A.album_name as title,A.created_at,'' as description,'' as location,P.total_comments,P.photo_thumb as thumb,P.photo_url as url,P.title as name,'image' as type,IFNULL(total_views,0) AS total_views from album_master A JOIN (select * from photo_master GROUP BY album_id) P ON P.album_id=A.id)
        UNION  
        (SELECT id,user_id,title,created_at,description,location,total_comments,video_thumb as thumb,video_url as url,title as name,'video' as type,IFNULL(total_views,0) AS total_views from video_master)) PV JOIN user_master U ON U.id=PV.user_id where PV.user_id=${user_id} ORDER BY PV.created_at desc LIMIT ${start},${limit}`;
        
        return functions.selectQuery(sql); 
    },

   



    /*******************************/


  
}

module.exports = clientDao;