const express = require("express");
const qr = require("qrcode");
var datetimeDifference  = require('datetime-difference');
const queue = require("./src/kyma.js");
const config = require("./src/config.js");
const {hdbext,hanaConfig} = require('./src/config.js');
const db = require("./src/db.js");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
app.set("views", "./views");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
var rooms = {}

//-----------------------------------------------------------------------------------------------------------------
//----------------API Endpoints------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------
app.get("/", (req, res) => {
    rooms = config.filter_rooms(rooms)
  res.render("index", { rooms: rooms,url:config.url })
});

app.get('/health', (req, res) => {
  const data = {
    uptime: process.uptime(),
    message: 'Ok',
    date: new Date()
  }
  res.status(200).send(data);
});

app.post("/twitter", (req, res) => {
  console.log(req.body.room)
  const message=queue.shareontwitter(rooms[req.body.room].score)
  res.send(rooms[req.body.room].score)
});

app.get("/delete/:room", (req, res) => {
 queue.deleteQueue(req.params.room)
 delete rooms[req.params.room]
  res.send("queue Deleted")
});

app.get("/gameboard/:room", (req, res) => {
  res.render("gameboard", {
    roomid: req.params.room,url:config.url
  });
});

app.post("/room", (req, res) => {
  if (rooms[req.body.room] != null) {
    return res.redirect("/")
  }
  config.createroom(req.body.room) //insert room in db
  rooms[req.body.room] = { users:{}, capecity: req.body.capecity,token:"",total_capecity: req.body.capecity,score: [],time: new Date(),race:"close"};
  queue.getToken().then(token =>{
    rooms[req.body.room].token = token
    queue.createQueue(req.body.room,"player",rooms[req.body.room].token)
  })
  res.redirect(req.body.room)
})

app.get("/welcome/:room", (req, res) => {
  res.render("welcome", { roomid:req.params.room })
})

app.get("/consume/:room", (req, res) => {
  var reads= []
  var first_event = -1;
  for(var i=0;i<500;i++){
    var message =  queue.consumemessages(req.params.room,rooms[req.params.room].token).then(data=>{
      return data
    }).catch(data =>{res.send(data)});
  console.log("value of i=" + i)
  message.then(data=>{
    if(!data.name){
      var result = config.prepareResult(first_event,reads);
        console.log(result)
      res.send(reads)
    }
    else{
      if(first_event == -1)
      first_event = data.time
     reads.push(data)
    }
  })
  }
})

// ------------game room entrance for players from welcome page-------------------------------------
app.post("/:room", (req, res) => {
  console.log(req.body.pname)
  if(rooms[req.params.room].capecity<0)
     res.render("index",{gamestarted:req.params.room+" is full, Join other Room",rooms,url:config.url})
  else
  res.render("room", { roomName: req.params.room, playername: req.body.pname,url:config.url })
})
// --------------------end--------------------------------------------------------------------------


app.get("/:room", (req, res) => {
  if (
    rooms[req.params.room] == null ||
    rooms[req.params.room].capecity < 0 ||
    (req.params.pname == null &&
      rooms[req.params.room].capecity != rooms[req.params.room].total_capecity)
  ) {
    return res.redirect("/");
  } else if (Object.keys(rooms[req.params.room].users).length == 0) {
    const url =config.url + "/welcome/" + req.params.room;
    qr.toDataURL(url, (err, src) => {
      if (err) res.send("Error occured")
      res.render("admin", { roomName: req.params.room, src: src,url:config.url })
    })
  } 
  else
    {
      console.log(req.params.pname)
      res.render("room", {roomName: req.params.room, playername: req.params.pname,url:config.url})
    }
})

const port = process.env.PORT || 3000
server.listen(port, function () {
  console.info("Listening on http://localhost:" + port)
})

//-----------------------------------------------------------------------------------------------------------------
//----------------Web sockets--------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------


io.on("connection", (socket) => {
  socket.on("new-user", (room, name) => {
    socket.join(room);
    rooms[room].users[socket.id] = name;
    if(name!="score"){
    rooms[room].score[name] = 0
    socket.to(room).to(rooms[room].users[0]).emit("user-connected", name);
    rooms[room].capecity--;
    }
    if (rooms[room].capecity < 0) {
      socket.to(room).broadcast.emit("room-full", name)
    }
    console.log(rooms)
  })

  socket.on("start-game", (room) => {
    rooms[room].race = "open"
    rooms[room].time= new Date()
    rooms[room].score={}
    for (const [key, value] of Object.entries(rooms[room].users)) {
      if(value!="admin" && value!="score")
      rooms[room].score[value]=0
    }
    socket.to(room).broadcast.emit("start-game", rooms[room].score)
  })
  socket.on("server-move-player", (room,player,x) => {
    socket.to(room).broadcast.emit("move-player", room,player,x)
    if(x>=85 && rooms[room].race=="open"){
      rooms[room].race = "close"

         //send data to database
         
            config.getEventMeshData(room).then(score_result=>{
              hdbext.createConnection(hanaConfig, function(error, client) {
                if (error) throw error;
                client.exec("SELECT * FROM game", function (err, rows) {
                  if (err) throw err;
                  if(config.compare_result(score_result[0],rows[0]) == true)
                    {
                      client.exec(`UPDATE game SET name='${score_result[0][0]}',score = ${score_result[0][1][0]}, time = ${score_result[0][1][1]} where ID = 1 `, function (err, affectedRows) {
                        if (err) throw err;
                        console.log('Number of affected rows:', affectedRows);
                    });
                    var leader = config.make_object(score_result[0]);
                    console.log("leader of game::")
                    console.log(leader);
                    rooms[room].score = [leader.NAME,leader.SCORE]
                    io.to(room).emit("end-game", score_result,leader,rows[0])
                    }
                    else{
                      rooms[room].score = [score_result[0][0],score_result[0][1][0]]
                      io.to(room).emit("end-game", score_result,rows[0])
                    }
                });
                    
              });
            })
    }
  })

  socket.on("game-data", (room) => {
    io.to(room).emit("game-data", rooms[room].score)
  })

  socket.on("event-mesh", (room, name) => {
    queue.sendmessages(room,"player",name,rooms[room].token)
  })

  socket.on("disconnect", () => {
    getUserRooms(socket).forEach((room) => {
      if(rooms[room].users[socket.id]!="score"){
        socket.to(room).broadcast.emit("user-disconnected", rooms[room].users[socket.id])
        rooms[room].capecity++
      }
        delete rooms[room].users[socket.id]
    })
  })
})

//-----------------------------------------------------------------------------------------------------------------
//----------------Methods------------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------------------------------

function getUserRooms(socket) {
  return Object.entries(rooms).reduce((names, [name, room]) => {
    if (room.users[socket.id] != null) names.push(name)
    return names
  }, [])
}