const socket = io(url);
const game_character = ['b1.png','b2.png','b1.png','b2.png','b2.png'];
const messageForm = document.getElementById('send-container');

if (messageForm != null) {
  const name = "score"
  socket.emit('new-user', roomName, name)
}

socket.on('start-game', data => {
  //create div for game character and appear on the screens of all connected players
  document.getElementById("main").innerHTML = "";
 document.getElementById('showData').innerHTML = "";
  startGame(data);
  socket.emit('game-data', roomName)
})

socket.on('move-player', function(room,player,x) {
  $("#"+player).animate({left: x+'%'},200);
})

socket.on('end-game', function(data,leader,prev_leader) {
  tableFromJson(data,leader,prev_leader);
})
function tableFromJson(data,leader,prev_leader) {
  var pos = 1 ;
  var col = ["Rank","player","score","time"];
  var table = document.createElement("table");
  table.setAttribute('class', 'table table-striped table-dark');
  table.setAttribute('id','scoretable');
  var tr = table.insertRow(-1);                  
  for (var i = 0; i < col.length; i++) {
   var th = document.createElement("th");      
   th.innerHTML = col[i];
   tr.appendChild(th);
  }
  tr = table.insertRow(-1);  
  tr.className = "table-light";  
  var tabCell = tr.insertCell(-1);
  tabCell.innerHTML = "Best";
  var tabCell = tr.insertCell(-1);
  tabCell.innerHTML = leader.NAME;
  var tabCell = tr.insertCell(-1);
  tabCell.innerHTML = leader.SCORE;
  var tabCell = tr.insertCell(-1);
  tabCell.innerHTML = leader.TIME;
  if(prev_leader != undefined){
    tr = table.insertRow(-1); 
    var tabCell = tr.insertCell(-1);
    tabCell.innerHTML = "Previous Best";
    var tabCell = tr.insertCell(-1);
    tabCell.innerHTML = prev_leader.NAME;
    var tabCell = tr.insertCell(-1);
    tabCell.innerHTML = prev_leader.SCORE;
    var tabCell = tr.insertCell(-1);
    tabCell.innerHTML = prev_leader.TIME;
    pos++;
  }

  for (const value of Object.entries(data)) {
    if(value[1][0] == leader.NAME && value[1][1][0] == leader.SCORE && value[1][1][1]==leader.TIME)
    continue;
      tr = table.insertRow(-1);   
      var tabCell = tr.insertCell(-1);
      tabCell.innerHTML = pos++;
      var tabCell = tr.insertCell(-1);
      tabCell.innerHTML = value[1][0];
      var tabCell = tr.insertCell(-1);
      tabCell.innerHTML = value[1][1][0];
	  var tabCell = tr.insertCell(-1);
      tabCell.innerHTML = value[1][1][1];
  }
  var divShowData = document.getElementById('showData');
  divShowData.innerHTML = "";
  divShowData.appendChild(table);
  var form = createForm();
  divShowData.appendChild(form);
  divShowData.style.display="block";
}


function startGame(data) {
  var balloon_top=8,animation_time=1,image_index=0;
    for (let player_name in data) {
      if(player_name=='admin')
      continue;
      component(10,animation_time, balloon_top,player_name,image_index);
      balloon_top=balloon_top+18;
      animation_time=animation_time+0.3
      image_index++
  }
}

function component(balloon_left,animation_time, balloon_top,player_name,image_index) {
  var div = document.createElement("div");
  div.className = "balloon";
  div.style.left = balloon_left + "%";
  div.style.top = balloon_top + "%";
  div.style.animation = "drift "+animation_time+"s infinite alternate";
  div.id=player_name;
  div.style.background = `url(../img/${game_character[image_index]})`;
  div.style.backgroundRepeat = "no-repeat";
  div.innerHTML = player_name;
  document.getElementById("main").appendChild(div);
}

function createForm(){
  var form = document.createElement("form");
  form.setAttribute("method", "post");
  form.setAttribute("action", "../twitter");
  var FN = document.createElement("input");
  FN.setAttribute("type", "hidden");
  FN.setAttribute("name", "room");
  FN.setAttribute("value", roomName);
  var s = document.createElement("input");
  s.setAttribute("type", "submit");
  s.setAttribute("value", "Twitter Open Connector");
  s.setAttribute("class","btn btn-secondary col-4");
  form.appendChild(FN); 
  form.appendChild(s);
  return form; 
}