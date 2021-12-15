const AMQP = require('@sap/xb-msg-amqp-v100');
const xsenv = require('@sap/xsenv');
const axios = require('axios');
const querystring = require('querystring');
const logger = require('./logger')
const management = JSON.parse(process.env.management);
const messaging = JSON.parse(process.env.messaging);
const baseURL = "/hub/rest/api/v1/management/messaging";
const twitterurl = "https://twittershare.d6c9019.kyma-stage.shoot.live.k8s-hana.ondemand.com/";
const emCredsM = messaging.filter(function (em) {
    return em.protocol == 'amqp10ws'
});
var ss = {}
async function getToken() {
    const queue = querystring.encode({ query:  process.env.namespace }).split("=")[1]; 
    try {
    // Get token for EMS management
        let options1 = {
            method: "POST",
            url:  management[0].oa2.tokenendpoint + "?grant_type=client_credentials&response_type=token",
            headers: {
                'Authorization': 'Basic ' + Buffer.from( management[0].oa2.clientid + ':' +  management[0].oa2.clientsecret).toString('base64')
            }
        };
        logger.info(options1);
        let token = await axios(options1);
        return token.data.access_token;
    } catch (error) {
        logger.error("Erro Loading the access token for sending message", {meta:error});
        return error.message;
    }
};



async function createQueue(subdomain, subscriberTopic,token) {
    const queue = querystring.encode({ query: process.env.namespace }).split("=")[1];
    const topic = querystring.encode({ query: subscriberTopic }).split("=")[1];
        try {
            let options2 = {
                method: "PUT",
                url:  management[0].uri + baseURL + "/queues/" + queue + "%2F" + subdomain,
                headers: {
                    'Authorization': 'Bearer ' + token,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                }
            };
            let queueCreation = await axios(options2);
            try {
                // the generated topic will look like subscriberdomain/data, this topic is to be used in s4 to trigger the events
                let options3 = {
                    method: "PUT",
                    url:  management[0].uri + baseURL + "/queues/" + querystring.encode({ query: queueCreation.data.name }).split("=")[1] + "/subscriptions/" + queue +"%2F"+topic,
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        "Content-Type": "application/json",
                        "accept": "application/json"
                    }
                };
                logger.info(options3);
                let topicSubscription = await axios(options3);
                return topicSubscription;
            } catch (error) {
                logger.error("Error Creating Subscription", {meta:error});
                return error.message;
            }
        } catch (error) {
            logger.error("Error Creating Queue", {meta:error});
            return error.message;
        }
};

//send messages-----------------

async function sendmessages(subdomain, subscriberTopic, messages,token) {
    const queue = querystring.encode({ query: process.env.namespace }).split("=")[1]; 
        try {
            let options2 = {
                method: "POST",
                url:  messaging[2].uri +  "/messagingrest/v1/queues/" + queue + "%2F" + subdomain + "/messages",
                headers: {
                    'Authorization': 'Bearer ' + token,
                    "x-qos": 1     
                },
                data: {name:messages,time:new Date()}
            };
            let sendmessage = await axios(options2);
            return sendmessage;
        } catch (error) {
            logger.error("Error Sending message", {meta:error});
            return error.message;
        }
};

function timeout(){
    return new Promise((resolve, reject)=>{
       setTimeout(function() {
          console.log("players_data at end")
              resolve('');
          },5000);
    });
}

async function consumemessages(subdomain) {
    var players_data =[]
    const queue = process.env.namespace + "/" + subdomain ;
     try {
     // check for Queues available 
     let options = {
         url: management[0].oa2.tokenendpoint + "?grant_type=client_credentials&response_type=token",
         headers: {
             'Authorization': 'Basic ' + Buffer.from(management[0].oa2.clientid + ':' + management[0].oa2.clientsecret).toString('base64')
         }
     };
     let token = await axios(options);
     try {
         let option2 = {
             method: "Get",
             url: management[0].uri + baseURL + "/queues",
             headers: {
                 'Authorization': 'Bearer ' + token.data.access_token,
                 "Content-Type": "application/json",
                 "accept": "application/json"
             }
         };
         let messagingQueues = await axios(option2);
         console.info("Data with list of available queues recieved", messagingQueues.data);
         const queueList = new Array();
         // create list of queues
         for (let i = 0; i < messagingQueues.data.length; i++) {
             //console.log("ms queue name is" + messagingQueues.data[i].name)
             if(messagingQueues.data[i].name == queue)
             queueList.push({ "identifier": `Input${i+1}`, "address": `queue:${messagingQueues.data[i].name}` });
         }
         try {
             //create Client
             let emsoptions = {
                 uri: emCredsM[0].uri,
                 oa2: {
                     endpoint: emCredsM[0].oa2.tokenendpoint,
                     client: emCredsM[0].oa2.clientid,
                     secret: emCredsM[0].oa2.clientsecret
                 },
                 data: {
                     payload: new Buffer.allocUnsafe(20),
                     maxCount: 100,
                     logCount: 10
                  },
                   amqp: {
                     idleTimeoutMilliseconds: 2000,
                     idleTimeoutTryKeepAlive: false
                         }
             };
             const client = new AMQP.Client(emsoptions);
             client
                 .on('connected', (destination, peerInfo) => {
                     console.log(destination);
                     console.log('> Connected to Enterprsie Mesaging Service:', peerInfo.description);
                 })
                 .on('idle', (local) => {
                     console.log(local ? '> idle' : '> heartbeat');
                     client.disconnect();
                 })
                 .on('assert', (error) => {
                     console.log(error.message);
                 })
                 .on('error', (error) => {
                     console.log('> Error:', error.message);
                     client.disconnect();
                 })
                 .on('reconnecting', (destination) => {
                     console.log('> Reconnecting, using destination ' + destination);
                 })
                 .on('disconnected', (hadError, byBroker) => {
                     console.log('> Disconnected');
                 });
             client.connect();
             // Create subscription for each queue            
             queueList.forEach(element => {
                 client.receiver(element.identifier).attach(element.address)
                     .on('subscribed', () => {
                         console.log('info ' + element.identifier + ' subscribed to ' + element.address);
                     })
                     .on('data', (message) => {
                         players_data.push(message.payload.toString())
                         //console.log(message.payload.toString())
                          message.done();
                     })
                     .on('error', (error) => {
                         console.log(error.message);
                     });
             });
         } catch (error) {
             console.error("Error Creating Connection", error);
             return error;
         }
     } catch (error) {
         console.log(error);
         return error.message;
     }
     } catch (error) {
         console.error(error);
         return error.message;
     }
 return timeout().then(data =>{
     console.info('called disconnecting' );
     return players_data
 }).catch(err=>{
     console.error(err);
 });
}

async function shareontwitter(winner) {
    try {
    // Get token for EMS management
        let options1 = {
            method: "POST",
            url: twitterurl,
            data: winner
        };
        logger.info(options1);
        let sharetwitter = await axios(options1);
        return "success"
    } catch (error) {
        logger.error("Error sharing score", {meta:error});
        return error.message;
    }
};

module.exports = {
    createQueue: createQueue,
   sendmessages: sendmessages,
    shareontwitter: shareontwitter,
    consumemessages:consumemessages,
    getToken:getToken
};