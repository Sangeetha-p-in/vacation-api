module.exports = function(io) {
  "use strict";
  var fs = require("fs");
  var connections = [];
  var Files = {};
  var fs = require("fs");
  var moment = require("moment");

  var functions = require("../../helpers/functions");
  var config = require("../../server/config");
  var jwt = require("jsonwebtoken");
  var postsDao = require("../../dao/postsDao");

  // middleware
  // io.use((socket, next) => {
  //   console.log('-----------------------------------socket--------------------------------');
  //   console.log(socket.handshake)
  //   let token = socket.handshake.headers["AuthToken"];

  //   jwt.verify(token, config.secret, function (err, decoded) {
  //     if (err) {
  //       console.log("TOKEN", token);
  //       return next(new Error("authentication error"));
  //     } else {
  //       console.log("TOKEN", token);
  //       socket["user_id"] = decoded.user_id;
  //       socket["name"] = decoded.first_name + " " + decoded.last_name;
  //       return next();
  //     }
  //   });
  //   // socket["user_id"] = 95;
  //   // socket["name"] = "Krishnadas P";
  //   // return next();
  // });

  io.use((socket, next) => {
    console.log(
      "-----------------------------------socket--------------------------------"
    );
    let query = socket.handshake.query;

    if (query && query.user_id != undefined && query.name != undefined) {
      console.log("User", query.user_id, query.name);
      socket["user_id"] = query.user_id;
      socket["name"] = query.name;
      return next();
    } else {
      console.log("Err", query);
      return next(new Error("authentication error"));
    }

    // jwt.verify(token, config.secret, function (err, decoded) {
    //   if (err) {
    //     console.log("TOKEN", token);
    //     return next(new Error("authentication error"));
    //   } else {
    //     console.log("TOKEN", token);
    //     socket["user_id"] = decoded.user_id;
    //     socket["name"] = decoded.first_name + " " + decoded.last_name;
    //     return next();
    //   }
    // });
    // socket["user_id"] = 95;
    // socket["name"] = "Krishnadas P";
    // return next();
  });

  io.on("connection", function(socket) {
    connections.push(socket);
    // console.log("%s connected", connections.length);
    socket.join(socket.user_id, () => {});
    let sql = `SELECT group_id FROM group_members WHERE user_id = '${socket.user_id}' `;
    // console.log(sql);
    functions
      .selectQuery(sql)
      .then(groups => {
        console.log(groups, "Groups");
        groups.forEach(element => {
          // console.log(element.group_id);
          socket.join("group" + element.group_id, () => {
            let rooms = Object.keys(socket.rooms);
            // console.log(`${socket.name}'s Rooms`, rooms);
          });
          
        });
        // console.log("Currently %d user(s) joined.", connections.length);
        
      })
      .catch(err => {
        // console.log("Select groupid error", err);
      });
      
    socket.on("tweet", function(tweet) {
      console.log(tweet);
      socket.emit("tweeted", tweet);
    });

    socket.on("leave group", function(data) {
      let group_id = data.group_id;
      socket.leave("group" + group_id, call => {
        socket.to(socket.user_id).emit("group leaved", { group_id: group_id });
      });
    });

    socket.on("is typing", function(data) {
      socket.broadcast.emit("typing", { nickname: data.nickname });
    });

    socket.on("remove group", data => {
      let group_id = data.group_id;
      socket.leave("group" + group_id, call => {});
    });

    //  socket.on('leave you',function(data)  {
    //     let group_id=data.group_id;
    //     socket.leave();
    //  });

    socket.on("send chatmessage", function(data) {
      if (data.group_id == undefined) {
        let params = {
          user_id: socket.user_id,
          group_name: "",
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
          description: "",
          image: "",
          type: "message"
        };

        postsDao.createGroup(params).then(result => {
          console.log(result);
        });
      }
      data["name"] = socket.name;
      data["user_id"] = socket.user_id;
      var message = {
        user_id: socket.user_id,
        group_id: data.group_id,
        message: data.message,
        created_at: moment().format("YYYY-MM-DD HH:mm:ss")
      };
      
      functions.insert("message_master", message)
      .then(messageDetails => (postsDao.getSingleChatDetails({message_id: messageDetails.insertId})))
      .then(messageData => {
        console.log(messageData[0],"group" + data.group_id)
        io.to("group" + data.group_id).emit("receive chatmessage", messageData[0]);
      })
      .catch(err => {
        console.log("Err: ", err);
      });
    });

    socket.on("disconnect", function() {
      socket.emit("disconnected");
      connections.splice(connections.indexOf(socket), 1);
      console.log("%d user(s) connected.", connections.length);
    });
  });
};