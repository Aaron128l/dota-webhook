import got from "got"
import { z } from "zod"

// 	players: `players/${RealSteamId}`,
export const profileSchema = z.object({
	account_id: z.number(),
	personaname: z.string().nullable(),
	name: z.string().nullable(),
	plus: z.boolean(),
	cheese: z.number().nullable(),
	steamid: z.string().nullable(),
	avatar: z.string().nullable(),
})
export type Profile = z.infer<typeof profileSchema>
export type ProfileDetails = Pick<
	Profile,
	"account_id" | "avatar" | "personaname"
> & {
	account_id: NonNullable<Profile["account_id"]>
	avatar: NonNullable<Profile["avatar"]>
	personaname: NonNullable<Profile["personaname"]>
}
// 	players: `players/${RealSteamId}`
export const playersSchema = z.object({
	solo_competitive_rank: z.number().optional(),
	competitive_rank: z.number().optional(),
	rank_tier: z.number().optional(),
	leaderboard_rank: z.number().nullable(),
	profile: profileSchema,
})
export type Player = z.infer<typeof playersSchema>
// 	heroes: "heroes",: Hero
const heroSchema = z.object({
	id: z.number(),
	name: z.string(),
	localized_name: z.string(),
	primary_attr: z.string(),
	attack_type: z.string(),
	roles: z.array(z.string()),
})
export type Hero = z.infer<typeof heroSchema>
// Hero[]
export const heroesArraySchema = z.array(heroSchema)
export type HeroesArray = z.infer<typeof heroesArraySchema>
// matches
export const matchDetailsSchema = z.object({
	match_id: z.number(),
	dire_score: z.number(),
	radiant_score: z.number(),
})

export type MatchDetails = z.infer<typeof matchDetailsSchema>

// 	recent_matches: `players/${RealSteamId}/recentMatches`,: RecentMatches
const recentMatchesSchema = z.object({
	match_id: z.number(),
	player_slot: z.number(),
	radiant_win: z.boolean(),
	duration: z.number(),
	game_mode: z.number(),
	lobby_type: z.number(),
	hero_id: z.number(),
	start_time: z.number(),
	version: z.number().nullable(),
	kills: z.number(),
	deaths: z.number(),
	assists: z.number(),
	average_rank: z.number(),
	xp_per_min: z.number(),
	gold_per_min: z.number(),
	hero_damage: z.number(),
	tower_damage: z.number(),
	hero_healing: z.number(),
	last_hits: z.number(),
	lane: z.number().nullable(),
	lane_role: z.number().nullable(),
	is_roaming: z.boolean().nullable(),
	cluster: z.number(),
	leaver_status: z.number(),
	party_size: z.number().nullable(),
})

export type RecentMatches = z.infer<typeof recentMatchesSchema>
// RecentMatches[]
export const recentMatchesArraySchema = z.array(recentMatchesSchema)
export type RecentMatchesArray = z.infer<typeof recentMatchesArraySchema>

// 	hero_stats: "heroStats", : HeroStats
const heroStatsSchema = z.object({
	id: z.number(),
	name: z.string(),
	localized_name: z.string(),
	img: z.string(),
})

export type HeroStats = z.infer<typeof heroStatsSchema>
// HeroStats[]
export const heroStatsArraySchema = z.array(heroStatsSchema)
export type HeroStatsArray = z.infer<typeof heroStatsArraySchema>

export interface PlayerParams {
	steamId: string
}

export interface MatchParams {
	matchId: number
}

export enum ApiEndpoint {
	Players = "players/{0}",
	Matches = "matches/{0}",
	RecentMatches = "players/{0}/recentMatches",
	Heroes = "heroes",
	HeroStats = "heroStats",
}

// A utility function to format strings with parameters
function formatString(template: string, ...args: string[]): string {
	return template.replace(/{(\d+)}/g, (match, number) =>
		typeof args[number] !== "undefined" ? args[number] : match,
	)
}

// Generic API request function
export async function fetchFromApi<T>(
	endpoint: ApiEndpoint,
	params?: PlayerParams | MatchParams,
): Promise<T> | never {
	let url = `https://api.opendota.com/api/${endpoint}`

	// Replace placeholders in the URL with actual parameters
	if (params) {
		if ("steamId" in params) {
			url = formatString(url, params.steamId)
		} else if ("matchId" in params) {
			url = formatString(url, params.matchId.toString())
		}
	}

	try {
		const response = await got(url).json<T>()
		return response as T
	} catch (error) {
		console.log(`Error fetching data from ${url}`, error)
		throw Error(`Error fetching data from ${url} - ${error}`)
	}
}

export async function fetchHeroes(hero_id: Hero["id"]): Promise<Hero> | never {
	if (typeof hero_id === "undefined") {
		throw Error("hero_id in fetchHeroes is undefined")
	}
	const fetchHeroes = await fetchFromApi<HeroesArray>(ApiEndpoint.Heroes)
	const heroes: HeroesArray = heroesArraySchema.parse(fetchHeroes)
	const hero = heroes.find((hero) => hero.id === hero_id)
	if (typeof hero !== "undefined") {
		return hero
	}
	console.log(`Couldn't find hero id: ${hero_id}`)
	throw Error(`Couldn't find hero_id: ${hero_id} - in fetchHeroes`)
}

export async function latestRecentMatch(
	steam_id: PlayerParams["steamId"],
): Promise<RecentMatches> {
	const fetchRecentMatches = await fetchFromApi<RecentMatchesArray>(
		ApiEndpoint.RecentMatches,
		{
			steamId: steam_id,
		},
	)
	const matches: RecentMatchesArray =
		recentMatchesArraySchema.parse(fetchRecentMatches)
	return matches.toSorted((a, b) => b.start_time - a.start_time)[0]
}

export async function fetchMatchDetails(
	match_id: MatchDetails["match_id"],
): Promise<MatchDetails> | never {
	if (typeof match_id === "undefined") {
		throw Error("match_id in fetchMatchDetails is undefined")
	}
	const fetchMatchDetails = await fetchFromApi<MatchDetails>(
		ApiEndpoint.Matches,
		{
			matchId: match_id,
		},
	)
	return matchDetailsSchema.parse(fetchMatchDetails)
}

export async function fetchHeroStatsImage(
	hero_id: Hero["id"],
): Promise<HeroStats["img"]> | never {
	if (typeof hero_id === "undefined") {
		throw Error("hero_id in fetchHeroStats is undefined")
	}
	const fetchHeroStats = await fetchFromApi<HeroStatsArray>(
		ApiEndpoint.HeroStats,
	)
	const heroStats: HeroStatsArray = heroStatsArraySchema.parse(fetchHeroStats)
	const hero = heroStats.find((hero) => hero.id === hero_id)
	if (typeof hero !== "undefined") {
		return hero.img
	}
	console.log(`Couldn't find hero id: ${hero_id}`)
	throw Error(`Couldn't find hero_id: ${hero_id} - in fetchHeroes`)
}

export async function fetchPlayerProfile(
	steam_id: PlayerParams["steamId"],
): Promise<ProfileDetails> {
	const fetchPlayerProfile = await fetchFromApi<Player>(ApiEndpoint.Players, {
		steamId: steam_id,
	})

	const { profile }: Player = playersSchema.parse(fetchPlayerProfile)
	let { account_id, personaname, avatar } = profileSchema.parse(profile)

	personaname = personaname ?? "Hingle McCringleberry"
	avatar =
		avatar ??
		"https://pbs.twimg.com/profile_images/1456045731018588162/9XVAIpwZ_400x400.jpg"

	return {
		account_id,
		avatar,
		personaname,
	}
}
