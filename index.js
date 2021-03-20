require('dotenv').config()
const got = require('got')
const storage = require('node-persist')
const constrants = require('./constrants')
const Discord = require('discord.js')
const schedule = require('node-schedule')
const hook = new Discord.WebhookClient(process.env.DISCORD_ID, process.env.DISCORD_TOKEN)

const TEAMS = {
  RADIANT: 0,
  DIRE: 1
}

const convertTo32 = id => Number(BigInt(id) - BigInt('76561197960265728'))

const OpenDotaAPI = got.extend({
  prefixUrl: 'https://api.opendota.com/api',
  responseType: 'json'
})

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

const fetchProfile = async id => {
  try {
    const response = await OpenDotaAPI(`players/${id}`)
    return response.body
  } catch (error) {
    throw new Error(error)
  }
}

const fetchMatch = async id => {
  try {
    const response = await OpenDotaAPI(`matches/${id}`)
    return response.body
  } catch (error) {
    throw new Error(error)
  }
}

const recentGames = async id => {
  try {
    const response = await OpenDotaAPI(`players/${id}/recentMatches`)
    return response.body
  } catch (error) {
    throw Error(error)
  }
}

const fetchHeros = async () => {
  try {
    const response = await OpenDotaAPI('heroes')
    return response.body
  } catch (error) {
    throw new Error(error)
  }
}

const fetchHeroStats = async () => {
  try {
    const response = await OpenDotaAPI('heroStats')
    return response.body
  } catch (error) {
    throw new Error(error)
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
  party_size,
  game_mode,
  lobby_type,
  duration,
  start_time,
  dire_score,
  radiant_score,
  Team
}) => {
  const payload = {
    username: `Dota 2 Tracker (v3?)`,
    // avatarURL: 'https://avatarfiles.alphacoders.com/372/37238.png',
    embeds: [
      {
        author: {
          name: profile.profile.personaname,
          url: `https://www.opendota.com/players/${profile.profile.account_id}`,
          icon_url: profile.profile.avatar
        },
        title: `Match #${match_id}`,
        url: `https://www.opendota.com/matches/${match_id}`,
        thumbnail: {
          url: `https://api.opendota.com${hero.img}`
        },
        description: `**${Win ? 'Win' : 'Loss'}** - __**${Team === TEAMS.RADIANT ? `${radiant_score} - ${dire_score}` : `${dire_score} - ${radiant_score}`}**__`,
        fields: [
          {
            name: 'Hero',
            value:
              `Played as: ${hero.localized_name}\n` +
              `Kills: ${kills}\n` +
              `Deaths: ${deaths}\n` +
              `Assists: ${assists}\n\n` +
              `XP per minute: ${xp_per_min}\n` +
              `Gold per minute: ${gold_per_min}`,
            inline: true
          },
          {
            name: 'Damage',
            value:
              `Hero Damage: ${hero_damage}\n` +
              `Tower Damage: ${tower_damage}\n` +
              `Hero Healing: ${hero_healing}\n` +
              `Last hits: ${last_hits}`,
            inline: true
          },
          {
            name: 'Match Details',
            value:
              `Duration: ${new Date(duration * 1000).toISOString().substr(11, 8)}\n` +
              `Start: ${new Date(start_time * 1000).toDateString()}\n` +
              `Game Mode: ${game_mode}\n` +
              `Lobby Type: ${lobby_type}\n` +
              `Party Size: ${party_size}`
          }
        ]
      }
    ]
  }

  return hook.send(payload)
}

const dotaLoop = async id => {
  // Get Recent Games
  let games
  try {
    games = await recentGames(id)
    if (!games) return console.log('No games found...')
  } catch (error) {
    throw new Error('Unable to fetch Recent Games')
  }

  // Check if we have recently saved games
  let savedGames = await storage.getItem('recentMatches')
  if (!savedGames) {
    // If storage doesn't exist, set the recent games as storage
    // and wait for next iteration
    await storage.setItem('recentMatches', games)
    return
  }

  // Compair all recent games to see if matchID matches the stored games
  const New_Games = games.filter(game => {
    if (savedGames.some(x => x.match_id === game.match_id)) return false
    return true
  })

  if (!New_Games.length) return console.log('No new games...')


  /*
  * Extracting infomation since the openapi doesn't include it in recent games
  * Such as score, hero name, hero img, gametype and lobbytype
  * It all is included into the game variable due to me not wanting to over complicate it
  */

  // If new game - get HerosStats
  // const heros = await fetchHeros()
  const heros = await fetchHeroStats()
  const profile = await fetchProfile(id)
  for await (game of New_Games) {
    const { dire_score, radiant_score } = await fetchMatch(game.match_id)
    const { hero_id, player_slot, radiant_win } = game
    const hero = heros.find(x => x.id === hero_id)
    const Team = player_slot >= 0 && player_slot <= 127 ? TEAMS.RADIANT : TEAMS.DIRE
    const Win =
      (Team === TEAMS.RADIANT && radiant_win) || (Team === TEAMS.DIRE && !radiant_win)
        ? true
        : false

    const game_mode = constrants.game_mode[game.game_mode].name
    const lobby_type = constrants.lobby_type[game.lobby_type].name

    console.log(`Post ${game.match_id}`)

    sendDiscordWebhook({
      ...game,
      hero,
      profile,
      Team,
      Win,
      game_mode,
      lobby_type,
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
    await storage.init()
    schedule.scheduleJob('* * * * *', async () => {
      try {
        await dotaLoop(id)
      } catch(_) {}
    })

    await dotaLoop(id)
  } catch(error) {
    console.error('Error starting dotaLoop()')
    console.error(error)
  }
}

init()
