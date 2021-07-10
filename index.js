const Discord = require('discord.js');
var https = require('https');
var http = require('http');
var fs = require('fs');
const express = require('express');
const app = express();
const port = 8080;
require('dotenv').config();

const options = {
    protocol: 'https:',
    host: 'www.googleapis.com',
    path: '/youtube/v3/channels?key=' + process.env.API_TOKEN + '&id=' + process.env.YOUTUBE_CHANNEL_ID + '&part=statistics',
};

// discord channel to send messages to
let channel = null,
    timeout = null,
    interval = null;

// when the discord client is ready
const client = new Discord.Client();
client.on('ready', () => {
    console.log('Bot started');
    channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID)
    fs.readFile('./time.json', (err, data) => {
        if (err) {
            console.log(err);
        } else {
            setMessageTimeout(JSON.parse(data));
        }
    })
});
// use the .env bot_token from discord to login
client.login(process.env.BOT_TOKEN)

// necessary for ping or no?
// app.get('/', (_, res) => {
//     res.send('Nobody here.')
//     console.log("/set?bot=" + process.env.BOT_TOKEN);
// })

app.use(express.json());
app.post('/set/user/' + process.env.USER_ID, (req, res) => {
    if (req.header('Content-Type') !== 'application/json') {
        res.status(500).send('Specify Content-Type header to be application/json');
        return;
    }
    new_time = req.body
    fs.readFile('./time.json', (err, data) => {
        if (err) {
            console.log(err);
            res.status(500).send(err);
            return;
        } else {
            let old_time = JSON.parse(data);
            new_time.time.hours != null ? old_time.time.hours = new_time.time.hours : null;
            new_time.time.minutes != null ? old_time.time.minutes = new_time.time.minutes : null;
            new_time.time.seconds != null ? old_time.time.seconds = new_time.time.seconds : null;
            new_time.time.interval != null ? old_time.time.interval = new_time.time.interval : null;
            fs.writeFile('./time.json', JSON.stringify(old_time), (err) => {
                if (err) {
                    console.log(err);
                    res.status(500).send(err);
                } else {
                    setMessageTimeout(old_time);
                    res.status(200).send('successfully set time');
                }
            });
        }
    })
});

function setMessageTimeout(timeJSON) {
    let now = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(timeJSON.time.hours);
    tomorrow.setMinutes(timeJSON.time.minutes);
    tomorrow.setSeconds(timeJSON.time.seconds);
    let difference = (tomorrow.getTime() - now.getTime()) % 86400000;
    console.log(now)
    console.log(tomorrow)
    console.log(timeJSON)
    console.log(difference)
    console.log(tomorrow.getTime() - now.getTime())
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        setMessageInterval(timeJSON);
    }, difference);
}

function setMessageInterval(timeJSON) {
    clearInterval(interval);
    interval = setInterval(() => {
        fetchAndSend();
    }, timeJSON.interval);
}

function fetchAndSend() {
    try {
        https.request(options, (response) => {
            var str = '';
            response.on('data', (chunk) => {
                str += chunk;
            });
            response.on('end', () => {
                let response = JSON.parse(str);
                console.log(response);
                let count = response.items[0].statistics.subscriberCount;
                let msg = /*'<@541648949916991498> is currently at ' +*/ count + ' subscribers.';
                channel.send(msg);
            });
        }).end();
    } catch (err) {
        console.log(err);
    }

}

app.listen(port, () => {
    console.log('Listening on port: ' + port);
})