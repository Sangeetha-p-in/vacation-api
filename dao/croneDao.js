let functions = require('../helpers/functions'),
    mysql = require('mysql');

let croneDao = {
   
    
    selectDrawMeetings(current_date){
      let sql = `SELECT id
                   FROM meeting_master 
                   WHERE DATE(draw_date) <='${current_date}' AND draw_completed='N'`;
        return functions.selectQuery(sql);  
    },
    selectFinalLists(meeting_id,token_number){
      let sql = `SELECT id
                   FROM meeting_tickets
                   WHERE meeting_id='${meeting_id}' AND (id % ${token_number}) = 0`;
        return functions.selectQuery(sql);  
    },
    selectFinalWinner(meeting_id){
      let sql = `SELECT id
                   FROM meeting_tickets
                   WHERE meeting_id='${meeting_id}' ORDER BY RAND() LIMIT 1`;
        return functions.selectQuery(sql);  
    },
    getExpiredBids(current_date,current_time){
      let sql = `SELECT id,bid_end_time,DATE_FORMAT(bid_end_date, '%Y-%m-%d') as bid_end_date,current_top_bid_consumer_id
                   FROM bid_master 
                   WHERE DATE(bid_end_date) <='${current_date}' AND bid_status='in_progress'`;
        return functions.selectQuery(sql);  
    }

}

module.exports = croneDao;