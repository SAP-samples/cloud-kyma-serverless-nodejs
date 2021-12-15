const socket = io(url)
const messageContainer = document.getElementById('message-container')
const messageForm = document.getElementById('send-container')
if (messageForm != null) {
  const name = "admin"
  socket.emit('new-user', roomName, name)
  messageForm.addEventListener('submit', e => {
    e.preventDefault()
    appendMessage(`play game`)
  })
}

socket.on('user-connected', name => {
  if(name!="score")
  appendMessage(`${name}  joined`)
})

socket.on('room-full', name => {
  if(name!="score")
  appendMessage('Room is Full')
})

socket.on('user-disconnected', name => {
  appendMessage(`${name} left`)
})

function appendMessage(message) {
  const messageElement = document.createElement('div')
  messageElement.innerText = message
  messageContainer.append(messageElement)
}

function start(){
  socket.emit('start-game', roomName)
}