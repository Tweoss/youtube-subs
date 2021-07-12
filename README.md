# youtube-subs
Simple discord bot. Uses youtube api to obtain subscriber count on a daily basis and sends the result to channels specified in the .env. 

.env (not commited to the repository) should contain 
* BOT_TOKEN=the token given by discord for the bot
* API_TOKEN=the api token from google for youtube api
* YOUTUBE_CHANNEL_ID=the channel id, found in the url by navigating to youtuber's page
* USER_ID=the user id used for basic verification in http post requests that can set interval and time
* DISCORD_CHANNEL_ID=the channel to send results to
* LOG_CHANNEL_ID=where to log changes
* COMMAND_PREFIX=the bot's command prefix for commands such as \*help (where the \* is the prefix)
