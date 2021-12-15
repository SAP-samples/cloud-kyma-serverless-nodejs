const axios = require('axios');
const url = "Paste Twitter API Endpoint URL"
const Authorization = "Paste Twitter Authorization Token here"
module.exports = {
  main:async function (event, context) {
       try {
        let options1 = {
            method: "POST",
            url: url,
            headers: {
                'Authorization': Authorization,
                'Content-Type': 'application/json'
            },
            data: {
                'status': "Winner of the game is " + event.data[0] + " score is " + event.data[1]
            }
        };
        console.info(options1);
        let status = await axios(options1);
        return "Winner of the game is " + event.data[0] + "score is " + event.data[1]
    } catch (error) {
        console.error("Error", error);
        return error.message;
    }
    
  }
}