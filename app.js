
/**
 * Module dependencies.
 */

  console.log("require('express')");
var express = require('express');
  console.log("require('./routes')");
var routes = require('./routes');
  console.log("require('./routes/user'')");
var user = require('./routes/user');
  console.log("require('http')");
var http = require('http');
  console.log("require('socket.io')");
var socketio = require('socket.io'); //socket.io를 사용하기 위해 추가합니다.
  console.log("require('path')");
var path = require('path');
  console.log("require('redis')");
var redis = require('redis'); //redis를 사용하기 위해 추가합니다.
  console.log("require('util')");
const util = require('util');
//console.log(util.inspect(myObject, {showHidden: false, depth: null}))
// alternative shortcut
//console.log(util.inspect(myObject, false, null))

var app = express(); //express 객체를 만듭니다.
var server = null; //express 객체를 이용하여 http 서버 객체를 저장할 변수입니다. 지금은 비워둡니다.
var io = null; //socket.io 객체를 담아두기 위한 객체이며, 지금은 비워둡니다.

//redis의 subscriber와 publisher를 생성해둡니다.
var subscriber = redis.createClient();
var publisher = redis.createClient();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'pug');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/users', user.list);


//app 객체의 설정이 끝났으므로 이것을 이용하여 서버를 만듭니다.
server = http.createServer(app);
//HTTP서버를 이용하여 socket.io를 초기화합니다.
io = socketio.listen(server);

//전체 접속한 사용자들을 저장하기 위한 배열입니다.
var users = [];

io.set('log level', 0);
io.sockets.on('connection', function (socket) {
  console.log('io.connection, ');

  //console.log('connection, socket:' + util.inspect(socket, {showHidden: false, depth: null}));

	//사용자가 접속했을 때의 상황을 처리하는 부분입니다.
	socket.on('join', function (raw_msg) {
    console.log('socket.join, raw_msg:' + util.inspect(raw_msg, {showHidden: false, depth: null}));
		var msg = JSON.parse(raw_msg);
		var channel = "";
		
		if(msg["channel"] != undefined) {
			channel = msg["channel"];
		}
		
		socket.join(msg.workspace);
    //사멸된 함수
		//socket.set('workspace', msg.workspace);
		
		//사용자 접속에 대한 내용을 처리합니다.
		users.push(msg.username);
		index = users.length - 1;
		
		//다른 접속자들에게 새로운 사용자의 접속을 알려주고 목록을 갱신하게 합니다.
		socket.broadcast.emit("someone_joined", JSON.stringify(users));
		socket.emit("someone_joined", JSON.stringify(users));
	});
	
	//사용자가 메시지를 보냈을 때의 상황을 처리하는 부분입니다.
	socket.on('message', function (raw_msg) {
    console.log('socket.message, raw_msg:' + util.inspect(raw_msg, {showHidden: false, depth: null}));
		var msg = JSON.parse(raw_msg);
		var channel = "";
		
		if(msg["channel"] != undefined) {
			channel = msg["channel"];
		}
		
		if (channel == "chat") {
			var chatting_message = msg.username + " : " + msg.message;
			
			//발행자 객체가 누군가가 쓴 채팅 메시지를 발행하여 다른 구독자들에게 알려줍니다.
			publisher.publish('chat', chatting_message);
		}
	});
	
	//사용자가 채팅방을 나갔을 때의 상황을 처리하는 부분입니다.
	socket.on('leave', function (raw_msg) {
    console.log('socket.leave, raw_msg:' + util.inspect(raw_msg, {showHidden: false, depth: null}));
		var msg = JSON.parse(raw_msg);
		
		socket.leave(msg.workspace);
		
		//현재 접속되어 있는 사용자들의 목록에서 채팅방을 나간 사용자를 삭제합니다.
		var index = users.indexOf(msg.username);
		users.splice(index, 1);
		
		//다른 접속자들에게 누가 나갔는 지 알려주고, 접속자 목록을 갱신하게 합니다.
		socket.broadcast.emit("someone_leaved", msg.username);
		socket.broadcast.emit("refresh_userlist", JSON.stringify(users));
	});
	
	//구독자 객체가 메시지를 받으면 소켓을 통해 메시지를 전달합니다.
	subscriber.on('message', function (channel, message) {
    console.log('subscriber.message, channel:' + channel + ', message:' + message);
		socket.emit("communication_message", message);
	});
	
	//구독자 객체는 'chat'을 구독하기 시작합니다.
  console.log('io.connect, subscribe');
	subscriber.subscribe('chat');
}); 

//소켓의 연결이 끊길 대 처리하는 부분입니다.
io.sockets.on('close', function (socket) {
  console.log('io.close, ');
	subscriber.unsubscribe();
	publisher.close();
	subscriber.close();
});

console.log("startup http://localhost:" + app.get('port'));

//서버를 시작하는 부분입니다. 바로 이 지점에서 비로소 서버가 실행됩니다.
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
  console.log("http://localhost:" + app.get('port'));
  console.log("http://localhost:" + app.get('port') + '/index.html');
});


