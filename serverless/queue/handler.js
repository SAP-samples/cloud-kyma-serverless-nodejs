const axios = require('axios');
const hdbext = require('@sap/hdbext');   
const management = JSON.parse(process.env.management);
const querystring = require('querystring');
var datetimeDifference  = require('datetime-difference')
const baseURL = "/hub/rest/api/v1/management/messaging";
var rooms = []; 
const hanaConfig = { //Paste HANA hdi-shared Service-key 
};

async function deletequeue(room)
{
    const queue = querystring.encode({ query: process.env.namespace }).split("=")[1];
        try {
            let options1 = {
                method: "POST",
                url: management[0].oa2.tokenendpoint + "?grant_type=client_credentials&response_type=token",
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(management[0].oa2.clientid + ':' + management[0].oa2.clientsecret).toString('base64')
                }
            };
            console.info(options1);
            let token = await axios(options1);
            
            try {
                let options2 = {
                    method: "DELETE",
                    url: management[0].uri + baseURL + "/queues/" + queue + "%2F" + room,
                    headers: {
                        'Authorization': 'Bearer ' + token.data.access_token
                    }
                };
                let deletequeue = await axios(options2);
                return "queue deleted";
            } catch (error) {
                console.error("Error deleting message", error);
                return error.message;
            }
        } catch (error) {
            console.error("Error", error);
            return error.message;
        }
}

function deleteroom(room){
    hdbext.createConnection(hanaConfig, function(error, client) {
    if (error) {
      return console.error(error);
    }
client.exec(`DELETE FROM rooms WHERE NAME='${room}'`, function (err, rows) {
    if (err) throw err;
        console.log(' deleted room : ' + room);
        return rows;
  });
   });
}



function filterrooms(rooms){
    const date1 = new Date()
    var arr = []
    for(var i=0;i<rooms.length;i++)
    {
        var date2 = new Date(rooms[i].TIME);
        const timediff = datetimeDifference(date1,date2)
        if(timediff.hours>2)
        {
           const result1 = deletequeue(rooms[i].NAME);
           console.log(result1)
           const result2 = deleteroom(rooms[i].NAME);
           console.log(result2)
           arr.push(rooms[i].NAME)
        }
    }
    return arr
}

function getroom()
{
     hdbext.createConnection(hanaConfig, function(error, client) {
    if (error) {
      return console.error(error);
    }
client.exec("SELECT * FROM rooms", function (err, rows) {
    if (err) throw err;
        console.log(' rows:', rows);
        rooms=Array.from(rows);
  });
   });
   
}

function intervalFunc() {
    getroom();
    setTimeout(function(){
        if(rooms.length){
            const arr = filterrooms(rooms);
            console.log(arr)
        }
    }, 3000);
}


module.exports = {
    main: async function (event, context) {
          setInterval(intervalFunc, 3600000)
    }
}
