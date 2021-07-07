require('dotenv').config()
// Discord
const Discord = require('discord.js')
const client = new Discord.Client()

const got = require('got')
const storage = require('node-persist')
const common_tags = require('common-tags')

// Luxon
const { DateTime, Duration, Settings } = require('luxon')
Settings.defaultZoneName = 'America/Denver'

const TEAMS = {
  RADIANT: 0,
  DIRE: 1
}

const OpenDotaAPI = got.extend({
  prefixUrl: 'https://api.opendota.com/api',
  responseType: 'json'
})

const fetchHeros = async () => {
  try {
    const response = await OpenDotaAPI('heroes')
    return response.body
  } catch (error) {
    console.error(error)
    throw new Error(error)
  }
}

client.on('ready', async () => {
  await storage.init()
  console.log('Bot Connected to WebSocket')
})

client.ws.on('INTERACTION_CREATE', async interaction => {
  // do stuff and respond here
  const [SavedGames, Heros] = await Promise.all([storage.getItem('recentMatches'), fetchHeros()])

  const Results = {
    kills: 0,
    deaths: 0,
    assists: 0,
    wins: 0,
    losses: 0,
    heros: {},
    totalDuration: 0
  }

  for (const {
    kills,
    deaths,
    assists,
    duration,
    player_slot,
    radiant_win,
    hero_id
  } of SavedGames) {
    Results.kills += kills
    Results.deaths += deaths
    Results.assists += assists
    Results.totalDuration += duration

    const Team = player_slot >= 0 && player_slot <= 127 ? TEAMS.RADIANT : TEAMS.DIRE
    const Win = (Team === TEAMS.RADIANT && radiant_win) || (Team === TEAMS.DIRE && !radiant_win)
    Win ? (Results.wins += 1) : (Results.losses += 1)

    // Hero calculation
    const hero = Heros.find(x => x.id === hero_id)

    if (hero.localized_name in Results.heros === false) {
      Results.heros[hero.localized_name] = {
        kills: 0,
        deaths: 0,
        assists: 0,
        wins: 0,
        losses: 0,
        duration: 0
      }
    }

    Win
      ? (Results.heros[hero.localized_name].wins += 1)
      : (Results.heros[hero.localized_name].losses += 1)
    Results.heros[hero.localized_name].kills += kills
    Results.heros[hero.localized_name].deaths += deaths
    Results.heros[hero.localized_name].assists += assists
    Results.heros[hero.localized_name].duration += duration
  }

  let Embed = {
    title: 'Recent Stats (last 20 games)',
    type: 'rich',
    description: common_tags.stripIndents`
    Recent 20 games:
    Total Kills: ${Results.kills}
    Total Deaths: ${Results.deaths}
    Total Assists: ${Results.assists}
    Total W/L: ${Results.wins}/${Results.losses}
    Total Time Played: ${Duration.fromMillis(Results.totalDuration * 1000).toFormat(
      `h 'hours and' m 'minutes'`
    )}
    `,
    fields: Object.keys(Results.heros).map(key => {
      const hero = Results.heros[key]
      const dur = Duration.fromMillis(hero.duration * 1000)
        .shiftTo('hours', 'minutes', 'seconds')
        .normalize()
      return {
        name: key,
        value: common_tags.stripIndents`
        Kills: ${hero.kills}
        Deaths: ${hero.deaths}
        Assists: ${hero.assists}
        Win/Loss: ${hero.wins}/${hero.losses}
        Duration: ${dur.hours ? dur.hours + ' hours, ' : ''}${
          dur.minutes ? dur.minutes + ' minutes' : ''
        }
        `,
        inline: true
      }
    })
  }

  client.api.interactions(interaction.id, interaction.token).callback.post({
    data: {
      type: 4,
      data: {
        embeds: [Embed]
      }
    }
  })
})

client.login(process.env.DISCORD_BOT_TOKEN)
