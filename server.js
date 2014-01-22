var express = require('express');

var server = express();

server.use(express.logger());
server.use(express.static(__dirname + '/public'));

var port = 1618;

server.listen(port);
console.log('Listening on port ' + port);
