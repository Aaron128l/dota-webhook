// Slash Commands
require('dotenv').config()

const { Client } = require('discord.js')
const client = new Client()

const GuildID = process.env.GUILD_ID

async function installCommands() {
  const commands = await client.api.applications(client.user.id).guilds(GuildID).commands.get()
  for (const command of commands) {
    await client.api.applications(client.user.id).guilds(GuildID).commands(command.id).delete()
    console.log(`Deleted ${command.id}`)
  }

  console.log('Done')
  // /recentGames
  await client.api
    .applications(client.user.id)
    .guilds(GuildID)
    .commands.post({
      data: {
        name: 'recentGames',
        description: 'Display Recent Games in Dota 2'
      }
    })
  console.log(`Added /recentGames to ${GuildID}`)
  client.destroy()
}

client.login(process.env.DISCORD_BOT_TOKEN)
client.on('ready', () => {
  installCommands()
})
