import { EmbedBuilder, WebhookClient, bold, underscore } from "discord.js"
import { HTTPError } from "got"
import { DateTime as dt, Duration, Settings } from "luxon"
import { z } from "zod"
import { GameModeType, GameModes } from "./gamemodes.js"
import {
  Hero,
  HeroStats,
  MatchDetails,
  PlayerParams,
  ProfileDetails,
  RecentMatches,
  fetchHeroStatsImage,
  fetchHeroes,
  fetchMatchDetails,
  fetchPlayerProfile,
  latestRecentMatch,
} from "./opendota.js"

const envSchema = z.object({
  STEAMID: z.string(),
  DISCORD_ID: z.string(),
  DISCORD_TOKEN: z.string(),
  POLL_TIME_SECONDS: z.coerce.number().optional(),
})

Settings.defaultZone = "America/Denver"

const {
  STEAMID,
  DISCORD_ID,
  DISCORD_TOKEN,
  POLL_TIME_SECONDS = 5 * 60,
} = envSchema.parse(process.env)

const RealSteamId: PlayerParams["steamId"] = (
  BigInt(STEAMID) - BigInt("76561197960265728")
).toString()

const DiscordWebhook = new WebhookClient({
  id: DISCORD_ID,
  token: DISCORD_TOKEN,
})

enum Teams {
  Radiant = 0,
  Dire = 1,
}

function sendWebhook(
  match: RecentMatches,
  matchDetails: MatchDetails,
  hero: Hero,
  heroImg: HeroStats["img"],
  profile: ProfileDetails,
): void {
  // Determine Team
  const { match_id, player_slot, radiant_win } = match
  const Team =
    player_slot >= 0 && player_slot <= 127 ? Teams.Radiant : Teams.Dire
  const didWin =
    (Team === Teams.Radiant && radiant_win) ||
    (Team === Teams.Dire && !radiant_win)

  // Determine Score
  const { radiant_score, dire_score } = matchDetails
  const Scoreboard =
    Team === Teams.Radiant
      ? `${radiant_score} - ${dire_score}`
      : `${dire_score} - ${radiant_score}`

  // Determine Profile
  let { avatar, personaname, account_id } = profile
  personaname = personaname ?? "Hingle McCringleberry"
  avatar =
    avatar ??
    "https://pbs.twimg.com/profile_images/1456045731018588162/9XVAIpwZ_400x400.jpg"

  // Determine Gamemode
  const Gamemode =
    GameModes.find(({ id }) => id === match.game_mode)?.name ??
    GameModes[GameModeType.Unknown].name

  function toTitleCase(s: string) {
    return s.replace(/\w\S*/g, (t) => {
      return t.charAt(0).toUpperCase() + t.substring(1).toLowerCase()
    })
  }
  const gamemode_regex = Gamemode.match(/^game_mode_(\w+)$/)
  const GamemodePretty = gamemode_regex?.[1]
    ? toTitleCase(gamemode_regex[1].replace("_", " "))
    : "Unknown"

  const embed = new EmbedBuilder()
    .setTitle(`Match #${match_id}`)
    .setColor(didWin ? 0x00ff00 : 0xff0000)
    .setAuthor({
      name: personaname,
      url: `https://www.opendota.com/players/${account_id}`,
      iconURL: avatar,
    })
    .setURL(`https://www.opendota.com/matches/${match_id}`)
    .setThumbnail(`https://cdn.cloudflare.steamstatic.com${heroImg}`)
    .setFooter({
      text: dt.now().toLocaleString(dt.DATETIME_MED_WITH_WEEKDAY),
    })
    .setDescription(
      `${bold(didWin ? "Win" : "Loss")} - ${underscore(bold(Scoreboard))}`,
    )
    .addFields([
      {
        name: "Stats",
        value: `Hero: ${hero.localized_name}
					K/D/A: ${match.kills}/${match.deaths}/${match.assists}
					XPM: ${match.xp_per_min}
					GPM: ${match.gold_per_min}
					Game Mode: ${GamemodePretty}`,
        inline: true,
      },
      {
        name: "Performance",
        value: `HD ${match.hero_damage}
					TD: ${match.tower_damage}
					HH: ${match.hero_healing}
					Last hits: ${match.last_hits}`,
        inline: true,
      },
      {
        name: "Match Details",
        value: `Duration: ${Duration.fromObject({
          seconds: match.duration,
        }).toFormat("hh:mm:ss")}
				Start: ${dt
          .fromSeconds(match.start_time)
          .toLocaleString(dt.DATETIME_MED)}`,
      },
    ])

  DiscordWebhook.send({ username: "Dota Tracker (v4)", embeds: [embed] })
  console.log(
    `${dt.now().toLocaleString(dt.DATETIME_SHORT_WITH_SECONDS)}: New Match: ${
      match.match_id
    }`,
  )
}

let lastRecordedMatch: RecentMatches | null = null
async function EventLoop(): Promise<void> {
  // Determine New Games
  let recentMatch: RecentMatches
  try {
    recentMatch = await latestRecentMatch(RealSteamId)
  } catch (err) {
    if (err instanceof HTTPError) {
      console.error(
        `${dt
          .now()
          .toLocaleString(dt.DATETIME_SHORT_WITH_SECONDS)}:got HTTP error: ${
          err.code
        } ${err.response.statusCode} - ${err.request.requestUrl} - ${
          err.response.body
        }`,
      )
      return
    }
    console.error("Failed to get recentMatch from API")
    return
  }

  if (!lastRecordedMatch?.start_time) {
    console.log(
      `${dt
        .now()
        .toLocaleString(
          dt.DATETIME_SHORT_WITH_SECONDS,
        )}: lastRecordedMatch doesn't have a record. Setting recent match as lastRecordedMatch.`,
    )
    lastRecordedMatch = recentMatch
  }

  if (recentMatch.start_time <= lastRecordedMatch.start_time) {
    console.log(
      `${dt
        .now()
        .toLocaleString(
          dt.DATETIME_SHORT_WITH_SECONDS,
        )}: Not a new match... Ending eventloop...`,
    )
    return
  }

  // New Match
  lastRecordedMatch = recentMatch

  let matchDetails = undefined
  let hero = undefined
  let heroImg = undefined
  let profile = undefined

  try {
    matchDetails = await fetchMatchDetails(recentMatch.match_id)
    hero = await fetchHeroes(recentMatch.hero_id)
    heroImg = await fetchHeroStatsImage(recentMatch.hero_id)
    profile = await fetchPlayerProfile(RealSteamId)
  } catch (err) {
    if (err instanceof HTTPError) {
      console.error(
        `${dt
          .now()
          .toLocaleString(dt.DATETIME_SHORT_WITH_SECONDS)}: got HTTP error: ${
          err.code
        } - ${err.response.statusCode} - ${err.request.requestUrl} - ${
          err.response.body
        }`,
      )
      return
    }
    console.error("Error fetching data:", err)
    return
  }

  sendWebhook(recentMatch, matchDetails, hero, heroImg, profile)
}

// Auto Start Cron Job Every Minute
setInterval(() => {
  EventLoop()
}, POLL_TIME_SECONDS * 1000)

console.log("Program Startup - Fetching Recent Match IDs")
lastRecordedMatch = await latestRecentMatch(RealSteamId)
console.log(
  `Tracking from Match ID: ${lastRecordedMatch.match_id} - ${dt
    .fromSeconds(lastRecordedMatch.start_time)
    .toLocaleString(dt.DATETIME_MED)} Dota matches.`,
)

console.log(`Starting Loop Timer - ${POLL_TIME_SECONDS} seconds`)
