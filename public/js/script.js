const socket = io(url)
const messageForm = document.getElementById('send-container')
const game_character = ['b1.png','b2.png','b1.png','b2.png','b1.png'];
if (messageForm != null) {
  socket.emit('new-user', roomName, playername)
}

 //create div for game character and appear on the screens of all connected players
socket.on('start-game', data => {
  document.getElementById("myElem").style.display = "none";
  tempAlert("Play",5000,data);
  document.getElementById("main").innerHTML = "";
  document.getElementById('showData').innerHTML = "";
  socket.emit('game-data', roomName)
});

socket.on('move-player', function(room,player,x) {
  $("#"+player).animate({left: x+'%'},90);
})

socket.on('end-game', function(data,leader,prev_leader) {
  document.getElementById("myElem").innerHTML = "Game Over";
  document.getElementById("myElem").style.display = "block";
  setTimeout(function(){
    document.getElementById("myElem").style.display = "none";
      tableFromJson(data,leader,prev_leader);
  }, 3000);

})


//-------------methods--------------------------

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
  if(playername==player_name)
  div.style.color = "#000"; 
  div.style.animation = "drift "+animation_time+"s infinite alternate";
  div.id=player_name;
  div.style.background = `url(../img/${game_character[image_index]})`;
  div.style.backgroundRepeat = "no-repeat";
  div.innerHTML = player_name;
  document.getElementById("main").appendChild(div);
}

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
      if(value[1][0] == playername)
      tr.className = "table-light";  
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
  var a = createButton();
  divShowData.appendChild(a);
  divShowData.style.display="block";
}

function createButton(){
  var a = document.createElement("a"); 
  var link = document.createTextNode("Twitter Share");
  a.appendChild(link); 
  a.title = "Twitter Share"; 
  a.className = "btn btn-secondary col-4";
  a.href = "https://twitter.com/intent/tweet";
  return a; 
}

 function tempAlert(msg,duration,data){
  var rw = document.createElement("div");
  rw.setAttribute("class","container ");
  rw.setAttribute("style","text-align:center;")
  var el = document.createElement("h1");
  el.setAttribute("class","play-message animate__animated animate__zoomIn");
  el.setAttribute("id","countdown");
  el.innerHTML = "03";
  rw.appendChild(el);
  setTimeout(function(){
  rw.parentNode.removeChild(rw);
  },duration);
  document.body.appendChild(rw);
  display = document.querySelector('#countdown');
    startTimer(3, display,data);
   
}

function startTimer(duration, display,data) {
  var timer = duration, minutes, seconds;
  var ctw= setInterval(function () {
      seconds = parseInt(timer % 60, 10);
      seconds = seconds < 10 ? "0" + seconds : seconds;
      display.textContent = seconds;
      if (timer <= 0){
        display.textContent = "Go";
       startGame(data);
       clearInterval(ctw);
      }
      else{
        timer--
      }
  }, 1000);
}