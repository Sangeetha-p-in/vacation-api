let express = require('express'),
    app = express(),
    jwt = require('jsonwebtoken'),
    moment = require('moment'),
    randToken = require('rand-token'),
    jsonfile = require('jsonfile'),
    fs = require('fs'),
    config = require('../server/config'),
    user = require('../dao/userDao'),
    crone = require('../dao/croneDao'),
    functions = require('../helpers/functions'),
    emailValidator = require('email-validator');
    shuffle = require('shuffle-array');

    let handler = {

    index(req, res, next) {
        res.send('respond with a resource');
    },

    draw_meeting(req, res, next) {
      let final_id="";
      let meeting_id="";
      let star_id="";
          var current_date=moment().format('YYYY-MM-DD');    
            crone.selectDrawMeetings(current_date)
                .then((meeting_lists) => {
                    if (meeting_lists.length) {
                      var j=0;
                      meeting_lists.forEach((meeting)=>{

                        var div_number = randToken.generate(1,"123456789");
                        //var div_number = 1;
                        meeting_id = meeting.id;
                        star_id = meeting.star_id;
                           crone.selectFinalLists(meeting_id,div_number)
                                  .then((final_lists) => {
                                   if (final_lists.length > 0) {
                                   var final=shuffle.pick(final_lists, { 'picks': 1 });
                                    final_id=final.id;
                                   }else{

                                    crone.selectFinalWinner(meeting_id) 
                                     .then((final_winner) => {
                                        if (final_winner.length > 0) {
                                          final_id=final_winner[0].id;
                                          
                                         }else{
                                        return functions.update('meeting_master', { draw_completed: 'D',meeting_status: 'D' }, { id: meeting_id });

                                        }
                                     }) 
                                     .catch((err) => {
                                     console.log(err);
                                     })
                                   }
                                   return functions.get('meeting_tickets', { id: final_id });
                                     
                                  })
                                  .then((winner_details) => {

                                  if (winner_details.length){


                                    var notification_details={notification_type:5,event_id:meeting_id,from_user_id: star_id,to_user_id:winner_details[0].consumer_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                      functions.insert('notification_master', notification_details);  

                                    var notification_details={notification_type:6,event_id:meeting_id,from_user_id:winner_details[0].consumer_id,to_user_id:star_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                      functions.insert('notification_master', notification_details); 


                                   // get all ticket buyers
                                  user.getAllByers(meeting_id,winner_details[0].consumer_id)
                                          .then((result) => {
                                              if (result.length){
                                                  for (var i=0; i<result.length; i++) {                                        
                                                 var notification_details={notification_type:4,event_id:meeting_id,from_user_id: star_id,to_user_id:result[i].consumer_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                                      functions.insert('notification_master', notification_details)
                                                      handler.send_push_notifications();
                                                    }
                                              }
                                          })
                                          .catch((err) => {
                                              console.log(err);
                                          })    



                                    return functions.update('meeting_master', { winner_id: winner_details[0].consumer_id,winner_ticket_no: winner_details[0].ticket_number,draw_completed: 'Y',meeting_status:'C' }, { id: meeting_id });

                                  } 

                                  else throw 'Invalid Winner';

                                  })
                                  .then((upload_response) => {

                                  if ('affectedRows' in upload_response)
                                  {
                                    var date_time=moment().format('YYYY-MM-DD HH:mm:ss');
                                    functions.update('feed_master', { modified_date_time: date_time }, { event_id: meeting_id,feed_type: 1 });
                                    res.json({ "status": true, "message": "Success." });
                                  } 

                                      else res.json({ "status": false, "message": "Database Error.", "errorcode": "serverError" });

                                  })
                                  .catch((err) => {
                                    console.log(err);
                                   })
                                  
                         j++;
                                      if(j==meeting_lists.length){
                                        console.log("successfully");
                                        res.json({ "status": true,"function":"draw_meeting"});
                                      }
                      })

                     
                    }
                    else throw 'No drw meeting';

                })
               
                .catch((err) => {
                    console.log(err);
                    res.json({ "status": false, "message": err, "errorcode": "serverError","function":"draw_meeting" });
                })


    },
    
     stop_bid(req, res, next) {
        //console.log("123");
        var current_date=moment().format('YYYY-MM-DD');
        var current_time=moment().format('HH:mm:ss');
       crone.getExpiredBids(current_date,current_time)
                .then((bid_lists) => {
                    if (bid_lists.length) {
                      var j=0;
                        bid_lists.forEach((bid)=>{
                            if(bid.bid_end_date ==current_date){

                                if(bid.bid_end_time <=current_time){
                                    if(bid.current_top_bid_consumer_id!=0){
                                         var bid_status='completed';
                                    }else{
                                      var bid_status='dismissed';

                                    }
                                var notification_details={notification_type:8,bid_id:bid.id,from_user_id: bid.star_id,to_user_id:bid.current_top_bid_consumer_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                functions.insert('notification_master', notification_details);
                                var notification_details1={notification_type:9,bid_id:bid.id,from_user_id: bid.current_top_bid_consumer_id,to_user_id:bid.star_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                functions.insert('notification_master', notification_details1);
                                 // get all bid users
                                  user.getAllBiders(bid.id,bid.current_top_bid_consumer_id)
                                          .then((result) => {
                                              if (result.length){
                                                  for (var i=0; i<result.length; i++) {                                        
                                                 var notification_details={notification_type:7,bid_id:bid.id,from_user_id: star_id,to_user_id:result[i].consumer_id,date_time: moment().format('YYYY-MM-DD HH:mm:ss')};                                              
                                                      functions.insert('notification_master', notification_details)
                                                      handler.send_push_notifications();
                                                    }
                                              }
                                          })
                                          .catch((err) => {
                                              console.log(err);
                                          })  



                                var notification_details2={
                                  notification_type:6,
                                  bid_id:bid.id,
                                  from_user_id:bid.current_top_bid_consumer_id,                                  
                                  to_user_id:bid.star_id,
                                  date_time: moment().format('YYYY-MM-DD HH:mm:ss')
                                };                                              
                                functions.insert('notification_master', notification_details2);    

                                var date_time=moment().format('YYYY-MM-DD HH:mm:ss');   
                                functions.update('bid_master', { bid_status: bid_status, winner_id: bid.current_top_bid_consumer_id,win_date_time:date_time }, { id: bid.id })
                                

                                 .then((updateRes) => {
                                     var date_time=moment().format('YYYY-MM-DD HH:mm:ss');
                                     functions.update('feed_master', { modified_date_time: date_time }, { event_id: bid.id,feed_type: 2 });
                                                                    
                                  })
                                  .catch((err) => {
                                    console.log(err);
                                   }) 
                                }
                                
                            }else{
                                 functions.update('bid_master', { bid_status: 'completed'}, { id: bid.id })
                                 .then((updateRes) => {
                                  var date_time=moment().format('YYYY-MM-DD HH:mm:ss');
                                    functions.update('feed_master', { modified_date_time: date_time }, { event_id: bid.id,feed_type: 2 });
                                   
                                     
                                  })
                                  .catch((err) => {
                                    console.log(err);
                                   })
                            }                  
                            
                            j++;
                                      if(j==bid_lists.length){
                                        console.log("successfully");
                                        res.json({ "status": true,"function":"stop_bid"});
                                      }

                        
                        })
                       

                    }else throw  'No Bids for completion';
                    
                })
                .catch((err) => {
                    res.json({ "status": false, "message": err, "errorcode": "serverError","function":"stop_bid"  });
                })

    },   


    //////////////////////////////////////////////////////
}

module.exports = handler;