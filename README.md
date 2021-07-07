## Dota 2 Webhook
Create a .env in the project directory and apply to example below.

.env example
```
STEAM_API_KEY=
# 64-Bit Steam ID
STEAMID=

# Webhook ID and Token taken from the webhook URL
#https://canary.discord.com/api/webhooks/443324892966754337/SgV-_afkYQ_t2j4fxWAubAvAOaBKWpASN94MSAtLZ66Edg4hSxJA4ggV4pe_-zhAuLUh
# Where 443324892966754337 is the ID, and SgV-_afkYQ_t2j4fxWAubAvAOaBKWpASN94MSAtLZ66Edg4hSxJA4ggV4pe_-zhAuLUh is the TOKEN
DISCORD_ID=
DISCORD_TOKEN=
GUILD_ID=
```

To run:
```cli
yarn

# setup as crontab
* * * * * /usr/local/bin/node /home/aaron/dota-webhook/index.js

# Discord Slash Commands
node slash.js
node dota-discord.js
```

Enjoy, I guess ¯\\_(ツ)\_/¯