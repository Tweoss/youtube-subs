const Discord = require('discord.js');
var https = require('https');
const fs = require('fs')
const Canvas = require('canvas')
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
    log_channel = null,
    timeout = null,
    interval = null,
    count = null;

Canvas.registerFont('./fonts/Roboto-Medium.ttf', { family: 'Roberto' });

// when the discord client is ready
const client = new Discord.Client();
client.on('ready', () => {
    console.log('Bot started');
    channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID)
    log_channel = client.channels.cache.get(process.env.LOG_CHANNEL_ID)
    log_channel.send("Bot has (re)started.");
    fs.readFile('./time.json', (err, data) => {
        if (err) {
            console.log(err);
        } else {
            setMessageTimeout(JSON.parse(data));
        }
    })
});

// handle manual commands
client.on('message', (message) => {
    if (message.author.bot) {
        return;
    }
    if (message.content.startsWith(process.env.COMMAND_PREFIX)) {
        let args = message.content.replace(process.env.COMMAND_PREFIX, '').split(' '),
            command = args.shift();
        if (command == 'subs' || command == 's' || command == 'subcount') {
            fetchAndSend(message.channel);
        } else if (command == 'help' || command == 'h') {
            message.channel.send("```\n" +
                "Help:\n" +
                "\tsubs - shows the number of subscribers \n" +
                "\t\t(aliases: \"s\",\"subcount\")\n" +
                "\thelp - shows this help message\n" +
                "\t\t(aliases: \"h\")" +
                "```"
            )
        }
    }
});

// use the .env bot_token from discord to login
client.login(process.env.BOT_TOKEN)

// necessary for pinging
app.get('/', (_, res) => {
    res.send('Nobody here.')
})

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
    log_channel.send("Time has been set and is now " +
        JSON.stringify({ "hours": timeJSON.time.hours, "minutes": timeJSON.time.minutes, "seconds": timeJSON.time.seconds, "interval": timeJSON.time.interval }) +
        "\nThe next message will be sent at " + new Date(now.getTime() + difference) + " in " + Math.floor(difference / 3600000) + " hours, " + Math.floor(difference / 60000) % 60 + " minutes, and " + Math.floor(difference / 1000) % 60 +
        " seconds after which updates will be sent every " + Math.floor(timeJSON.time.interval / 3600000) + " hours, " + Math.floor(timeJSON.time.interval / 60000) % 60 + " minutes, and " + Math.floor(timeJSON.time.interval / 1000) % 60 +
        " seconds.\nIt is currently " + new Date() + ".");
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        setMessageInterval(timeJSON);
    }, difference);
}

function setMessageInterval(timeJSON) {
    clearInterval(interval);
    fetchAndSend(channel);
    interval = setInterval(() => {
        fetchAndSend(channel);
    }, timeJSON.time.interval);
}

function fetchAndSend(channelID) {
    try {
        https.request(options, (response) => {
            var str = '';
            response.on('data', (chunk) => {
                str += chunk;
            });
            response.on('end', () => {
                let response = JSON.parse(str);
                if (response.err != null) {
                    console.log(response.err);
                    return;
                }
                let old_count = count ? count : 0;
                count = response.items[0].statistics.subscriberCount;
                generateAndSendImage(count, old_count, channelID);
            });
        }).end();
    } catch (err) {
        console.log(err);
    }

}

function generateAndSendImage(count, old_count, channelID) {
    fs.readFile('./template.png', function(err, data) {
        if (err) { console.log(err); return; }
        let img = new Canvas.Image; // Create a new Image
        img.src = data;

        // Initialiaze a new Canvas with the same dimensions
        // as the image, and get a 2D drawing context for it.
        let canvas = new Canvas.Canvas(img.width, img.height);
        let ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);

        // print sub count
        ctx.font = '26pt "Roberto"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#7F7F7F';
        ctx.fillText(count + ' subscribers', 310, 150);
        // print percent change since last run
        ctx.font = '13pt "Roberto"';
        ctx.fillStyle = '#5785cf'; // blue
        old_count ? ctx.fillText((old_count >= count ? '+' : '') + ((old_count - count) / count * 100).toFixed(2) + '% since last run', 310, 150 + 40) : 0;
        let buffer = canvas.toBuffer('image/png');
        fs.writeFileSync('./count_output.png', buffer);
        channelID.send('', {
            files: [
                "./count_output.png"
            ]
        });
    });

}

app.listen(port, () => {
    console.log('Listening on port: ' + port);
})