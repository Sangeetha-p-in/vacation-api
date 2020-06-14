var fs = require("fs"),
  parseString = require("xml2js").parseString,
  configData = {
    secret: "newage2win",

    encrypt_algorithm: "aes-256-cbc",

    encrypt_pass: "newagesmb",

    fcm_key: "AIzaSyC0PQfBjCnN0b3_Oc6dVoDJaC1fqbhxtWY",
    email_header: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>VacationMe</title>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        </head>
        <body>`,
    VAPID: {
      "publicKey": "BFnzq-5DvF-H0RFFemPB-90T9HDkdjpjxI6qWzVGaMDBaJoTRLtVz6i2X6BGiBCXW-a5Q7UG6ujdZwR41Sj3Cvc",
      "privateKey": "dZEmtoW92ASkYil89jnvLbMUn5gan3Ebr5XlGxD4yyo"
    },

    email_footer: `
            <p><strong>Thanks,</strong></p>
            <p><strong>VacationMe Team</strong></p>
            </body></html>`,
    //profile_path: 'http://newagesme.com:7007/uploads/profile_images/',
    profile_path: "http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:7000/uploads/profile_images/",

    //team_profile_path: 'http://newagesme.com:7007/uploads/bid/',
    team_profile_path: "http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:7000/uploads/team_images/",

    upload_url: "public/uploads/",
    // email_verification: 'http://newagesme.com:7007/verification/email/',
    // email_verification: 'http://10.10.10.254/squadsports/verification/email/',

    // userPlaceholder : 'http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:5880/uploads/user_image_placeholder.png',
    // groupPlaceholder : 'http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:5880/uploads/placeholder-group.jpg',

    userPlaceholder : 'http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:5880/uploads/user_image_placeholder.png',
    groupPlaceholder : 'http://ec2-18-189-29-150.us-east-2.compute.amazonaws.com:5880/uploads/placeholder-group.jpg',

    min_duration: 0,

    max_duration: 24,

    min_price: 1,

    max_price: 1000,

    share_max: 100,
    // Min Date to post meeting 3 week 21 days
    min_day: 33,

    // Draw Date preior 3 days
    draw_day: 3,
    //page
    limit: 10,
    // port
    port: 5060,

    //
    max_bid_amount: 1000,

    //
    bid_difference_amount: 20,

    //
    admin_percentage: 10,
    //
    min_draw_days: 3,

    //
    max_draw_days: 30,

    max_days: 20,

    min_event_duration: 1,
    max_event_duration: 45,
    min_open_event_validity: 30,
    max_open_event_validity: 90,
    min_draw_event_day_difference: 1,
    max_draw_event_day_difference: 5,
    min_auction_validity: 30,
    max_auction_validity: 60,

    // buy tickets before before how many days
    buy_tickets_before: 3,

    your_stripe_api_key: "sk_test_6J3BrJu9xbWPbHbdsqIABHex",

    // email_header: `
    // <!DOCTYPE html>
    // <html>
    // <head>
    //     <title>Squad Sports</title>
    //     <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    // </head>
    // <body>
    //  <div style="background:#161616; padding: 2%;">
    //  <img style="margin:40px auto 0px auto;display: -webkit-box;width: 200px;" src="http://newagesme.com/squadsports/assets/images/logo-login.png">
    //  <div style="width:900px;margin:5% auto;background:#fff;padding:30px;border-radius:6px;">`,

    // email_footer: `
    // <br>
    //  <p style="font-size:24px;color:#007645;padding-top:50px;">Thanks,
    // <br>
    // Squad Sports Team</p>
    // </div>
    // </div>
    // </body></html>`,

    //         email_header_ticket:`<!doctype html>
    // <html>
    // <head>
    // <meta charset="utf-8">
    // <title>Gold Pass</title>
    // <style>
    //     @import url('https://fonts.googleapis.com/css?family=Oxygen:300');
    // </style>

    // </head>

    // <body style="background:#f4f4f4;font-family: 'Oxygen', sans-serif;">

    //     <div style="width: 715px;margin: 0 auto;border-radius: 6px;">
    //         <div style="background: #282828;position: relative;border-radius: 8px 8px 0px 0px;margin-top: 108px;">
    //             <div style="width: 144px;height: 134px;padding: 72px 0px 75px 0px;margin: 0 auto;">
    //                 <img src="http://demo.newagesme.com/goldpass/assets/mail/logo.png" style="width: 100%">
    //             </div>`,

    email_header_ticket: ``,
    email_footer_ticket: ``,

    getConfig: function () {
      return new Promise((resolve, reject) => {
        let data = fs.readFileSync("config.xml");
        parseString(data, (err, result) => {
          if (err) {
            reject(err);
            throw err;
          }
          resolve(result.preferences);
        });
      });
    }
  };

module.exports = configData;
