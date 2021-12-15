const {consumemessages} = require('./kyma')
var datetimeDifference  = require('datetime-difference')
const hdbext = require('@sap/hdbext');
const hanaConfig = { //Paste HANA hdi-shared Service-key 
};

 async function getEventMeshData(room){
  var x = await consumemessages(room)
  var y =await prepareResult(x)
  return y
}

 async function prepareResult(players_data){
  var result_array = []
  var players_last_event = {}
  var players_events_count = {}
  var first_event = -1
  for(var i=0;i<players_data.length;i++)
  {  
   var x =JSON.parse(players_data[i])
    if(first_event == -1)
    first_event = new Date(x.time)
    if(!players_events_count[x.name])
      players_events_count[x.name]=1
      else
      players_events_count[x.name]++
	  players_last_event[x.name] = new Date(x.time)
  }
   for (const [key, value] of Object.entries(players_events_count)) {
	var players_result = []
	  const timedifference = datetimeDifference(players_last_event[key],first_event)
    players_result.push(key)
	  players_result.push(value)
	  players_result.push(timedifference.seconds)
    result_array.push(players_result)
  }
  result_array= sorted(result_array) 
return result_array;
}


function sorted(data){
  var items = Object.keys(data).map(function(key) {
    return [data[key][0], [data[key][1],data[key][2]]];
  });
  items.sort(function(first, second) {
  if(second[1][0]!=first[1][0])
    return second[1][0] - first[1][0];
	return first[1][1] - second[1][1];
  });
  return items;
}

function compare_result(elm,obj){
  if(elm[1][0]>obj.SCORE || (elm[1][0] == obj.SCORE && elm[1][1]<obj.TIME))
  return true
  return false
}

function filter_rooms(rooms){
  const present_time = new Date();
  for (const [key, value] of Object.entries(rooms)) {
  const diff =  datetimeDifference(present_time,rooms[key].time)
    if(diff.hours>1)
    delete rooms[key]
  }
  return rooms
}

function make_object(data){
  var row = {NAME:data[0],SCORE:data[1][0],TIME:data[1][1]};
  return row
}

function createroom(room)
{
  hdbext.createConnection(hanaConfig, function(error, client) {
    if (error) {
      return console.error(error);
    }
    var x = new Date()
    client.exec(`INSERT INTO rooms (name,time) VALUES('${room}','${x}')`, function (err, result) {
    if (err) throw err;
        console.log(result+"room created");
  });
  });
}

module.exports = {
  getEventMeshData:getEventMeshData,
  prepareResult:prepareResult,
  compare_result:compare_result,
  filter_rooms:filter_rooms,
  make_object,make_object,
  hdbext:hdbext,
  hanaConfig:hanaConfig,
  createroom:createroom,
    url: "https://balloon.d6c9019.kyma-stage.shoot.live.k8s-hana.ondemand.com"
    //url: "http://localhost:3000"
  }