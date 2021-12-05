const dot = require('dotenv').config()
if (dot.error) throw dot.error

const Discord = require('discord.js')
let hook

// Stuff and Things
const got = require('got')
const storage = require('node-persist')

// Luxon
const { DateTime, Duration, Settings } = require('luxon')
Settings.defaultZoneName = 'America/Denver'

const TEAMS = {
  RADIANT: 0,
  DIRE: 1
}

const convertTo32 = id => Number(BigInt(id) - BigInt('76561197960265728'))

const OpenDotaAPI = got.extend({
  prefixUrl: 'https://api.opendota.com/api',
  responseType: 'json'
})

// Unused at this time...
const fetchSteamIds = async urlname => {
  try {
    const response = await got(`http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/`, {
      searchParams: {
        key: process.env.STEAM_API_KEY,
        vanityurl: urlname
      },
      responseType: 'json'
    })
    return response.body.response.steamid
  } catch (error) {
    throw new Error(error)
  }
}

const API_ENDPOINT = id => ({
  players: `players/${id}`,
  matches: `matches/${id}`,
  recentMatches: `players/${id}/recentMatches`,
  heroes: 'heroes',
  heroStats: 'heroStats'
})

const fetchAPI = async (path, id) => {
  try {
    const response = await OpenDotaAPI(API_ENDPOINT(id)[path])
    return [response.body, null]
  } catch (error) {
    console.error('API error: ', error)
    return [null, error]
  }
}

const sendDiscordWebhook = ({
  profile,
  match_id,
  Win,
  hero,
  kills,
  deaths,
  assists,
  xp_per_min,
  gold_per_min,
  hero_damage,
  tower_damage,
  hero_healing,
  last_hits,
  duration,
  start_time,
  dire_score,
  radiant_score,
  Team
}) => {
  const payload = {
    username: `Dota Tracker (v3)`,
    // avatarURL: 'https://avatarfiles.alphacoders.com/372/37238.png',
    embeds: [
      {
        author: {
          name: profile.profile.personaname,
          url: `https://www.opendota.com/players/${profile.profile.account_id}`,
          icon_url: profile.profile.avatar
        },
        color: Win ? '0x00FF00' : '0xFF0000',
        title: `Match #${match_id}`,
        url: `https://www.opendota.com/matches/${match_id}`,
        thumbnail: {
          url: `https://api.opendota.com${hero.img}`
        },
        footer: {
          text: DateTime.now().toLocaleString(DateTime.DATETIME_FULL)
        },
        description: `**${Win ? 'Win' : 'Loss'}** - __**${
          Team === TEAMS.RADIANT
            ? `${radiant_score} - ${dire_score}`
            : `${dire_score} - ${radiant_score}`
        }**__`,
        fields: [
          {
            name: 'Hero',
            value:
              `Hero: ${hero.localized_name}\n` +
              `K/D/A: ${kills}/${deaths}/${assists}\n` +
              `XPM: ${xp_per_min}\n` +
              `GPM: ${gold_per_min}`,
            inline: true
          },
          {
            name: 'Damage',
            value:
              `HD: ${hero_damage}\n` +
              `TD: ${tower_damage}\n` +
              `HH: ${hero_healing}\n` +
              `Last hits: ${last_hits}`,
            inline: true
          },
          {
            name: 'Match Details',
            value:
              `Duration: ${Duration.fromMillis(duration * 1000).toFormat('hh:mm:ss')}\n` +
              `Start: ${DateTime.fromSeconds(start_time).toLocaleString(DateTime.TIME_SIMPLE)}`
          }
        ]
      }
    ]
  }
  hook.send(payload)
}

const dotaLoop = async id => {
  // Get Recent Games
  const [games, error] = await fetchAPI('recentMatches', id)
  if (error) throw new Error(`Error Fetching recentMatches: ${error}`)

  if (!games) return console.log('No games found...')

  // Check if we have recently saved games
  let savedGames = await storage.getItem('recentMatches')
  if (!savedGames || process.env.CLEAR === 'true') {
    // If storage doesn't exist, set the recent games as storage
    // and wait for next iteration
    console.log('Reset Flag: DB Not Found or development mode ⚠')
    await storage.setItem('recentMatches', games)
    savedGames = games
  }

  // Compair all recent games to see if matchID matches the stored games
  const New_Games = games.filter(game => {
    if (savedGames.some(x => x.match_id === game.match_id)) return false
    return true
  })

  if (!New_Games.length) return console.log('No new games... 🙁')
  /*
   * Extracting infomation since the openapi doesn't include it in recent games
   * Such as score, hero name, hero img, gametype and lobbytype
   * It all is included into the game variable due to me not wanting to over complicate it
   */

  // If new game - get HerosStats
  const [heros, error2] = await fetchAPI('heroes')
  const [profile, error3] = await fetchAPI('players', id)
  if (error2 || error3) return console.log('Error attempting to fetch heroes/players')

  for await (const game of New_Games) {
    const [{ dire_score, radiant_score }, error4] = await fetchAPI('matches', game.match_id)
    if (error4) {
      console.error(`Error fetching match ${game.match_id}`)
      continue
    }
    const { hero_id, player_slot, radiant_win } = game
    const hero = heros.find(x => x.id === hero_id)
    const Team = player_slot >= 0 && player_slot <= 127 ? TEAMS.RADIANT : TEAMS.DIRE
    const Win = (Team === TEAMS.RADIANT && radiant_win) || (Team === TEAMS.DIRE && !radiant_win)

    console.log(`Post ${game.match_id}`)

    sendDiscordWebhook({
      ...game,
      hero,
      profile,
      Team,
      Win,
      dire_score,
      radiant_score
    })
  }

  // remember to save new games....
  await storage.setItem('recentMatches', games)
  console.log('Completed loop. Games saved.')
}

const init = async () => {
  const id = convertTo32(process.env.STEAMID)
  try {
    hook = new Discord.WebhookClient({id: process.env.DISCORD_ID, token: process.env.DISCORD_TOKEN})
    await storage.init()
    await dotaLoop(id)
    hook.destroy()
    console.log('Completed Script ✅')
  } catch (error) {
    console.error('Error starting dotaLoop()')
    console.error(error)
  }
}

init()
