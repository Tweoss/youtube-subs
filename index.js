'use strict'

const Discord = require('discord.js');
var https = require('https');
const fs = require('fs')
const Canvas = require('canvas')
const express = require('express');
const D3Node = require('d3-node')
const d3n = new D3Node()
const { svg2png } = require('svg-png-converter')
const csv = require('csv-parser');
const sharp = require('sharp');
const app = express();
const port = 8080;

require('dotenv').config();

const options = {
    protocol: 'https:',
    host: 'www.googleapis.com',
    path: '/youtube/v3/channels?key=' + process.env.API_TOKEN + '&id=' + process.env.YOUTUBE_CHANNEL_ID + '&part=statistics',
};

const API_TOKEN = process.env.API_TOKEN,
    BOT_TOKEN = process.env.BOT_TOKEN,
    COMMAND_PREFIX = process.env.COMMAND_PREFIX,
    CHANNEL_ID = process.env.DISCORD_DEBUG_ID,
    // CHANNEL_ID = process.env.DISCORD_CHANNEL_ID,
    LOG_ID = process.env.DISCORD_LOG_CHANNEL_ID,
    USER_ID = process.env.USER_ID,
    YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

// discord channel to send messages to
let channel = null,
    log_channel = null,
    timeout = null,
    interval = null,
    count = null,
    timeJSON = null;

Canvas.registerFont('./fonts/Roboto-Medium.ttf', { family: 'Roberto' });

// when the discord client is ready
const client = new Discord.Client();
client.setMaxListeners(0);
client.on('ready', () => {
    console.log('Bot started');
    channel = client.channels.cache.get(CHANNEL_ID);
    log_channel = client.channels.cache.get(LOG_ID)
    log_channel.send("Bot has (re)started.");
    fs.readFile('./time.json', (err, data) => {
        if (err) {
            console.log(err);
        } else {
            timeJSON = JSON.parse(data);
            setMessageTimeout();
        }
    })
});

// handle manual commands
client.on('message', async(message) => {
    if (message.author.bot) {
        return;
    }
    if (message.content.startsWith(COMMAND_PREFIX)) {
        let args = message.content.replace(COMMAND_PREFIX, '').split(' '),
            command = args.shift();
        if (command == 'subs' || command == 's' || command == 'subcount') {
            fetchAndSend(message.channel, false);
        } else if (command == 'help' || command == 'h') {
            const embed = new Discord.MessageEmbed()
                .setColor('#0099ff')
                .setAuthor('xOverBot', 'https://raw.githubusercontent.com/Tweoss/youtube-subs/master/x.png', 'https://github.com/tweoss/youtube-subs')
                .setThumbnail('https://raw.githubusercontent.com/Tweoss/youtube-subs/master/xOvernight_4.png')
                .setTitle('Youtube Sub Bot [*]')

            .addFields({ name: 'subs (aliases: s, subcount)', value: 'shows the number of subscribers' }, { name: 'help (aliases: h)', value: 'shows this help message' }, )
                .setTimestamp()
                .setFooter('Made by Stephanobros for xOvernight');

            message.channel.send(embed);
        } else if (command == 'z') {
            let sending = await getSubscriberCount(timeJSON, false);
            message.channel.send(sending)
        }
    }
});

// use the .env bot_token from discord to login
client.login(BOT_TOKEN)

// necessary for pinging
app.get('/', (_, res) => {
    res.send('Nobody here.')
})

app.use(express.json());
app.post('/set/user/' + USER_ID, (req, res) => {
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

function setMessageTimeout() {
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

// regularly scheduled message
function setMessageInterval(timeJSON) {
    clearInterval(interval);
    fetchAndSend(channel, true);
    interval = setInterval(() => {
        fetchAndSend(channel, true);
    }, timeJSON.time.interval);
}

function fetchAndSend(channelID, isScheduled) {
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
                generateAndSendImage(count, old_count, channelID, timeJSON.last.scheduled);
                if (isScheduled) {
                    timeJSON.last.scheduled = count;
                    fs.writeFile('./time.json', JSON.stringify(timeJSON), (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                }
            });
        }).end();
    } catch (err) {
        console.log(err);
    }

}

function generateAndSendImage(count, old_count, channelID, old_subs) {
    fs.readFile('./template.png', function(err, data) {
        if (err) { console.log(err); return; }
        let img = new Canvas.Image; // Create a new Image
        img.src = data;

        // Initialize a new Canvas with the same dimensions
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
        // print change since last run
        ctx.font = '13pt "Roberto"';
        ctx.fillStyle = '#5785cf'; // blue
        ctx.fillText(old_count ? (count >= old_count ? '+' : '') + (count - old_count) + ' last' : 'no value', 310, 150 + 60);
        ctx.fillText(old_subs ? (count >= old_subs ? '+' : '') + (count - old_subs) + ' last scheduled' : 'no value', 310, 150 + 40);
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

function getSubscriberCount(timeJSON, isScheduled) {
    let sub_options = options;
    sub_options.path = '/youtube/v3/channels?key=' + API_TOKEN + '&id=' + YOUTUBE_CHANNEL_ID + '&part=statistics';
    try {
        return new Promise(resolve => {
            // http request
            https.request(options, (response) => {
                var str = '';
                // build up message
                response.on('data', (chunk) => {
                    str += chunk;
                });
                // process message
                response.once('end', () => {
                    let response = JSON.parse(str);
                    if (response.err != null) {
                        console.log(response.err);
                        return;
                    }
                    let old_count = count ? count : timeJSON.last.run;
                    if (isScheduled) {
                        timeJSON.last.scheduled = count;
                        // add to past.csv
                        fs.appendFileSync('./past.csv', new Date().toISOString().replace(/T.*/, '').replace(/-/, '\/'));
                        if (err) { console.log(err); return; }
                    } else {
                        timeJSON.last.run = count;
                    }
                    count = response.items[0].statistics.subscriberCount;
                    // flush new state to disk
                    fs.writeFile('./time.json', JSON.stringify(timeJSON), (err) => {
                        if (err) {
                            console.log(err);
                        }
                    });
                    // read background image
                    fs.readFile('./xOvernight_4.png', function(err, img_data) {
                        if (err) { console.log(err); return; }
                        const d3 = d3n.d3;
                        let data = [];
                        let max_x, max_y, min_x, min_y;
                        // read csv file
                        fs.createReadStream('./past.csv')
                            .pipe(csv())
                            .on('data', (row) => {
                                // set the time to the beginning of the day
                                let time = new Date(parseInt(row.day));
                                time.setHours(0, 0, 0, 0);
                                row.day = time.getTime();
                                data.push(row);
                                if (row.day > max_x || max_x == null) {
                                    max_x = row.day;
                                }
                                if (row.day < min_x || min_x == null) {
                                    min_x = row.day;
                                }
                                for (const [key, value] of Object.entries(row)) {
                                    if (key !== 'day') {
                                        let v = parseInt(value);
                                        if (v > max_y || max_y == null) {
                                            max_y = v;
                                        }
                                        if (v < min_y || min_y == null) {
                                            min_y = v;
                                        }
                                    }
                                }
                            })
                            .on('end', async() => {
                                d3.select(d3n.document.querySelector('svg')).remove('svg')

                                // COLORS ---------------------------
                                // deterministic based on order
                                let colDict = {};
                                let channels = [];
                                for (const [key, _] of Object.entries(data[0])) {
                                    if (key !== 'day') {
                                        colDict[key] = genColors();
                                        channels.push(key);
                                    }
                                }
                                channels.sort();

                                // SIZE ---------------------------
                                const margin = { top: 50, right: 25, bottom: 25, left: 25 };
                                const width = 700 - margin.right - margin.left;
                                const height = 500 - margin.top - margin.bottom;

                                // MAIN SVG ---------------------------
                                const svg = d3.select(d3n.document.querySelector('body')).append('svg')
                                    .attr('width', width + margin.right + margin.left)
                                    .attr('height', height + margin.top + margin.bottom)
                                    .append('g')
                                    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

                                // SCALING ---------------------------
                                const xRange = [min_x, max_x];
                                const yRange = [min_y, max_y];
                                console.log(xRange, yRange);
                                // const yRange = [timeJSON.subscribe_range.min_y, timeJSON.subscribe_range.max_y];
                                // define scales (scaling from marks to pixels)
                                const xScale = d3.scaleTime().domain(xRange).range([20, width]);
                                const yScale = d3.scaleLinear().domain(yRange).range([height, 20]);

                                // AXES ---------------------------
                                const xAxis = d3.axisBottom()
                                    .scale(xScale)
                                    .tickSize(5)
                                    .ticks(9)
                                    .tickSizeInner(-height); // inner ticks are the grid lines
                                const yAxis = d3.axisRight()
                                    .scale(yScale)
                                    .tickSize(5)
                                    .ticks(10)
                                    .tickSizeInner(-width); // inner ticks are the grid lines
                                const xSvg = svg.append('g').attr('id', 'xAxisG').call(xAxis);
                                const ySvg = svg.append('g').attr('id', 'yAxisG').call(yAxis);
                                xSvg.selectAll('*').style('stroke', '#909090');
                                xSvg.selectAll('text').style('stroke', 'white');
                                xSvg.attr('transform', 'translate(0,' + height + ')');
                                ySvg.selectAll('*').style('stroke', '#909090');
                                ySvg.selectAll('text').style('stroke', 'white');
                                ySvg.attr('transform', 'translate(' + width + ',0)');

                                for (const key of channels) {
                                    // POINTS ---------------------------
                                    svg.selectAll('circle.' + key)
                                        .data(data)
                                        .enter()
                                        .append('circle')
                                        .attr('class', key)
                                        .attr('r', 5)
                                        .attr('cx', d => xScale(d.day))
                                        .attr('cy', d => yScale(d[key]))
                                        .style('fill', colDict[key]);

                                    // LINES ---------------------------
                                    let lineFunction = d3.line()
                                        .x(d => xScale(d.day))
                                        .y(d => yScale(d[key]));
                                    svg.append('path')
                                        .attr('class', 'tweets')
                                        .attr('d', lineFunction(data))
                                        .attr('fill', 'none')
                                        .attr('stroke', colDict[key])
                                        .attr('stroke-width', 5)

                                    // AREA ---------------------------
                                    var area = d3.area()
                                        .x(function(d) { return xScale(d.day); })
                                        .y0(height)
                                        .y1(function(d) { return yScale(d[key]); });
                                    // add the area
                                    svg.append("path")
                                        .data([data])
                                        .attr("class", "area")
                                        .attr("d", area)
                                        .style("fill", colDict[key] + '90');
                                }

                                // LEGEND ---------------------------
                                var legend_keys = [];
                                for (const key of channels) {
                                    legend_keys = legend_keys.concat([key]);
                                }
                                var lineLegend = svg.selectAll(".lineLegend").data(legend_keys)
                                    .enter().append("g")
                                    .attr("class", "lineLegend")
                                    .attr("transform", function(d, i) {
                                        return "translate(" + (margin.left) + "," + (i * 20) + ")";
                                    });
                                lineLegend.append("text").text(function(d) { return d; })
                                    .attr("transform", "translate(15, 6)") //align texts with boxes
                                    .style('stroke', 'white')
                                    .style('fill', 'white')
                                    .style('font-size', 20);
                                lineLegend.append("rect")
                                    .attr("fill", d => colDict[d])
                                    .attr("width", 12).attr('height', 5);

                                // TITLE ---------------------------
                                d3.select(d3n.document.querySelector('svg'))
                                    .append('text')
                                    .html('Subscribers Graph')
                                    .attr('x', width / 2 - margin.right)
                                    .attr('y', margin.top / 2)
                                    .attr('font', 'Georgia')
                                    .style('font-size', 25)
                                    .style('fill', 'white')
                                    .style('stroke', 'white');

                                // --------------------------- CONVERT TO PNG
                                const outputBuffer = await svg2png({
                                    input: d3n.svgString(),
                                    encoding: 'buffer',
                                    format: 'png',
                                    quality: 1
                                })

                                // --------------------------- OVERLAY and RETURNS
                                sharp('./Galaxy.png')
                                    .composite([{ input: outputBuffer, gravity: 'centre' }])
                                    .toBuffer().then(overlayBuffer => {
                                        let file = new Discord.MessageAttachment(overlayBuffer, 'count_output.png')
                                        resolve(
                                            new Discord.MessageEmbed()
                                            .setTitle('Subscribers [*s]')
                                            .setAuthor('xOverBot', 'https://raw.githubusercontent.com/Tweoss/youtube-subs/master/x.png', 'https://github.com/tweoss/youtube-subs')
                                            .setThumbnail('https://raw.githubusercontent.com/Tweoss/youtube-subs/master/xOvernight_4.png')
                                            .setColor('#0099ff')
                                            .addFields({ name: 'Current', value: count }, { name: 'Last Run', value: (count >= old_count ? '+' : '') + (count - old_count) }, { name: 'Last Scheduled Run', value: (count >= timeJSON.last.ran ? '+' : '') + (count - timeJSON.last.ran) })
                                            .setTimestamp()
                                            .setFooter('Made by Stephanobros for xOvernight')
                                            .attachFiles([file])
                                            .setImage('attachment://count_output.png')
                                        )
                                    })
                            });
                    });
                });
            }).end();
        });
    } catch (error) {
        console.log(error)
    }
}


// TODO: Make a function that lists the channels
// TODO: Make a function to add a channel via http request

// must make sure the colors are deterministic by order (otherwise the colors would be different each restart)
let INITIAL_HUE = 0.823;
const GOLDEN_RATIO_CONJUGATE = 0.618033988749895

function genColors() {
    INITIAL_HUE += GOLDEN_RATIO_CONJUGATE
    INITIAL_HUE %= 1
    return hsv_to_rgb(INITIAL_HUE * 360, 0.5, 0.95)
}

// returns rgb from hsv as a string
function hsv_to_rgb(h, s, v) {
    let r, g, b;
    let i;
    let f, p, q, t;

    // Make sure our arguments stay in-range
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(1, s));
    v = Math.max(0, Math.min(1, v));

    i = Math.floor(h / 60);
    f = h / 60 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    const hexify = (num) => {
        return Number(num).toString(16).padStart(2, '0');
    }
    return '#' + hexify(Math.floor(r * 255)) + hexify(Math.floor(g * 255)) + hexify(Math.floor(b * 255));
}