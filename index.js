const Discord = require('discord.js');
const { parse } = require('dotenv');
var https = require('https');
var http = require('http');
const client = new Discord.Client();

let interval = 1000 * 60 * 60 * 24,
    time_of_day =

    require('dotenv').config();

const options = {
    protocol: 'https:',
    host: 'www.googleapis.com',
    path: '/youtube/v3/channels?key=' + process.env.API_TOKEN + '&id=UCV0FN2UnOJl-CfCfYoFVC9g&part=statistics'
};

let channel = null;
const callback = function(response) {
    var str = '';
    response.on('data', function(chunk) {
        str += chunk;
    });
    response.on('end', function() {
        parse_send(channel, str);
    });
}

client.on('ready', () => {
    console.log('Bot started');
    channel = client.channels.cache.get(`862423609430638603`)
    send_http_timeout(channel);

});
client.login(process.env.BOT_TOKEN)

function send_http_timeout(channel) {
    https.request(options, callback).end();
    setInterval(function() {
        console.log("sending message");
        https.request(options, callback).end();
    }, 1000 * 60 * 60 * 24);
}

function parse_send(channel, json_string) {
    let response = JSON.parse(json_string);
    let count = response.items[0].statistics.subscriberCount;
    let msg = /*'<@541648949916991498> is currently at ' +*/ count + ' subscribers.';
    channel.send(msg);
}

http.createServer(function(req, res) {
    if (req.method == 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('No web page here.');
        res.end();
    } else if (req.method == 'POST') {

    }
}).listen(8000);

function resetTimeout(timeJSON) {

}