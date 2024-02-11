package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"
	_ "time/tzdata"

	"github.com/joho/godotenv"
)

func loadEnvVariableString(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		fmt.Println("Loaded in ", value, " from ", key)
		return value
	}
	fmt.Println("Loaded default value: ", defaultValue)
	return defaultValue
}

func loadEnvVariableInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			fmt.Println("Loaded in ", intValue, " from ", key)
			return intValue
		}
	}

	fmt.Println("Loaded default value: ", defaultValue)

	return defaultValue
}

var EnvSteamID string
var EnvDiscordURL string
var EnvPollTime int

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("No .env file found. Skipping...")
	}

	if env, exists := os.LookupEnv("STEAM_ID"); exists {
		EnvSteamID = env
	} else {
		log.Fatal("Missing STEAM_ID env variable. Quitting...")
	}

	if env, exists := os.LookupEnv("DISCORD_URL"); exists {
		EnvDiscordURL = env
	} else {
		log.Fatal("Missing DISCORD_URL env variable. Quitting...")
	}

	if env, exists := os.LookupEnv("POLL_TIME"); exists {
		if intValue, err := strconv.Atoi(env); err == nil {
			EnvPollTime = intValue
		} else {
			log.Fatal("POLL_TIME failed to convert to int. Quitting...")
		}
	} else {
		log.Fatal("Missing POLL_TIME env variable. Quitting...")
	}

	SteamID, err := convertSteam64to32(EnvSteamID)
	if err != nil {
		log.Fatalf("Unable to get Steam ID from %s. Quitting...", EnvSteamID)
	}

	fmt.Println("Aaron's Dota II Webhook")
	fmt.Println("Fetching Inital Match...")

	recentMatches, err := fetchAPIRecentMatches(SteamID)
	if err != nil || len(recentMatches) < 1 { // Should always be one
		log.Fatal("Error fetching first recent game. Exiting")
	}
	lastMatch := recentMatches[0]

	logger(fmt.Sprintf("Starting Event Loop - %d seconds", EnvPollTime))
	for {
		time.Sleep(time.Duration(EnvPollTime) * time.Second)

		recentMatches, err := fetchAPIRecentMatches(SteamID)
		if err != nil || len(recentMatches) < 1 { // Should always be one
			logger("Unable to fetch recentMatch... skipping")
			continue
		}

		// Sort the matches in descending order by StartTime
		sort.Slice(recentMatches, func(i, j int) bool {
			return recentMatches[i].StartTime > recentMatches[j].StartTime
		})

		recentMatch := recentMatches[0]
		if recentMatch.StartTime <= lastMatch.StartTime {
			logger("Not a new match... Ending eventloop...")
			continue
		}
		// Set new match
		lastMatch = recentMatch
		logger(fmt.Sprintf("New match %d", recentMatch.MatchID))

		// Fetch stuff
		matchDetail, err := fetchAPIMatchDetails(recentMatch.MatchID)
		if err != nil {
			fmt.Println(err)
			continue
		}

		profile, err := fetchAPIPlayer(SteamID)
		if err != nil {
			fmt.Println(err)
			continue
		}

		hero, err := fetchAPIHeroArray(recentMatch.HeroID)
		if err != nil {
			fmt.Println(err)
			continue
		}

		heroStats, err := fetchAPIHeroStatsArray()
		if err != nil {
			fmt.Println(err)
			continue
		}

		// Fetch Exact Hero
		heroImg, found := findHeroImgById(heroStats, recentMatch.HeroID)
		if !found {
			fmt.Println("Hero image not found")
			continue
		}

		sendWebhook(recentMatch, matchDetail, hero, heroImg, profile)
	}

}

type DiscordWebhook struct {
	Username  string  `json:"username,omitempty"`
	AvatarURL string  `json:"avatar_url,omitempty"`
	Embeds    []Embed `json:"embeds"`
}

type Embed struct {
	Title       string         `json:"title,omitempty"`
	Description string         `json:"description,omitempty"`
	URL         string         `json:"url,omitempty"`
	Thumbnail   EmbedThumbnail `json:"thumbnail,omitempty"`
	Color       int            `json:"color,omitempty"`
	Footer      EmbedFooter    `json:"footer,omitempty"`
	Author      EmbedAuthor    `json:"author,omitempty"`
	Fields      []EmbedField   `json:"fields,omitempty"`
}

type EmbedThumbnail struct {
	URL string `json:"url"`
}

type EmbedAuthor struct {
	Name    string `json:"name"`
	URL     string `json:"url,omitempty"`
	IconURL string `json:"icon_url,omitempty"`
}

type EmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

type EmbedFooter struct {
	Text string `json:"text"`
}

// Determine Team
const (
	Radiant int = iota
	Dire
)

func sendWebhook(match RecentMatchGames, matchDetail MatchDetails, hero Hero, heroImg string, profile Profile) {
	var Team int
	if match.PlayerSlot >= 0 && match.PlayerSlot <= 127 {
		Team = Radiant
	} else {
		Team = Dire
	}
	didWin := (Team == Radiant && match.RadiantWin) || (Team == Dire && !match.RadiantWin)

	// Determine Score
	var Scoreboard string
	if Team == Radiant {
		Scoreboard = fmt.Sprintf("%d - %d", matchDetail.RadiantScore, matchDetail.DireScore)
	} else {
		Scoreboard = fmt.Sprintf("%d - %d", matchDetail.DireScore, matchDetail.RadiantScore)
	}

	var embedColor int
	var descriptionText string
	if didWin {
		embedColor = 0x00ff00
		descriptionText = fmt.Sprintf("**Win** - __**%s**__", Scoreboard)
	} else {
		embedColor = 0xff0000
		descriptionText = fmt.Sprintf("**Loss** - __**%s**__", Scoreboard)
	}

	var personaName string
	if profile.PersonaName != nil {
		personaName = *profile.PersonaName
	} else {
		personaName = "Hingle McCringleberry"
	}

	var avatar string
	if profile.Avatar != nil {
		avatar = *profile.Avatar
	} else {
		avatar = "https://pbs.twimg.com/profile_images/1456045731018588162/9XVAIpwZ_400x400.jpg"
	}

	var GameMode string
	for _, game := range gameModes {
		if game.ID == match.GameMode {
			GameMode = game.Name
			break
		}
	}

	if GameMode == "" {
		GameMode = "Unknown"
	}
	GameMode = toTitleCase(GameMode)

	// Could be a own function...
	webhook := DiscordWebhook{
		Username: "Dota Tracker (v4)",
		Embeds: []Embed{
			{
				Title:       fmt.Sprintf("Match #%d", match.MatchID),
				Color:       embedColor,
				URL:         fmt.Sprintf("https://www.opendota.com/players/%d", profile.AccountID),
				Description: descriptionText,
				Footer: EmbedFooter{
					Text: getTimeNowWithTZ().Format("Mon, Jan 2, 2006, 3:04 PM"),
				},
				Author: EmbedAuthor{
					Name:    personaName,
					IconURL: avatar,
					URL:     fmt.Sprintf("https://www.opendota.com/matches/%d", match.MatchID),
				},
				Thumbnail: EmbedThumbnail{
					URL: fmt.Sprintf("https://cdn.cloudflare.steamstatic.com%s", heroImg),
				},
				Fields: []EmbedField{
					{
						Name: "Stats",
						Value: fmt.Sprintf(
							"Hero: %s\n"+
								"K/D/A: %d/%d/%d\n"+
								"XPM: %d\n"+
								"GPM: %d\n"+
								"Game Mode: %s",
							hero.LocalizedName,
							match.Kills, match.Deaths, match.Assists,
							match.XPPerMin,
							match.GoldPerMin,
							GameMode),
						Inline: true,
					},
					{
						Name: "Performance",
						Value: fmt.Sprintf(
							"HD: %d\n"+
								"TD: %d\n"+
								"HH: %d\n"+
								"Last hits: %d",
							match.HeroDamage,
							match.TowerDamage,
							match.HeroHealing,
							match.LastHits),
						Inline: true,
					},
					{
						Name: "Match Details",
						Value: fmt.Sprintf(
							"Duration: %s\n"+
								"Start: %s",
							formatDuration(match.Duration),
							formatTimestamp(match.StartTime),
						),
					},
				},
			},
		},
	}

	payloadBuf := new(bytes.Buffer)
	json.NewEncoder(payloadBuf).Encode(webhook)
	resp, err := http.Post(EnvDiscordURL, "application/json", payloadBuf)
	if err != nil {
		fmt.Println("Unable to send Webhook:", err)
	} else {
		logger("Webhook Successfully Sent")
	}

	defer resp.Body.Close()
}

type GameMode struct {
	ID       int
	Name     string
	Balanced bool
}

var gameModes = []GameMode{
	{ID: 0, Name: "game_mode_unknown", Balanced: true},
	{ID: 1, Name: "game_mode_all_pick", Balanced: true},
	{ID: 2, Name: "game_mode_captains_mode", Balanced: true},
	{ID: 3, Name: "game_mode_random_draft", Balanced: true},
	{ID: 4, Name: "game_mode_single_draft", Balanced: true},
	{ID: 5, Name: "game_mode_all_random", Balanced: true},
	{ID: 6, Name: "game_mode_intro"},
	{ID: 7, Name: "game_mode_diretide"},
	{ID: 8, Name: "game_mode_reverse_captains_mode"},
	{ID: 9, Name: "game_mode_greeviling"},
	{ID: 10, Name: "game_mode_tutorial"},
	{ID: 11, Name: "game_mode_mid_only"},
	{ID: 12, Name: "game_mode_least_played", Balanced: true},
	{ID: 13, Name: "game_mode_limited_heroes"},
	{ID: 14, Name: "game_mode_compendium_matchmaking"},
	{ID: 15, Name: "game_mode_custom"},
	{ID: 16, Name: "game_mode_captains_draft", Balanced: true},
	{ID: 17, Name: "game_mode_balanced_draft", Balanced: true},
	{ID: 18, Name: "game_mode_ability_draft"},
	{ID: 19, Name: "game_mode_event"},
	{ID: 20, Name: "game_mode_all_random_death_match"},
	{ID: 21, Name: "game_mode_1v1_mid"},
	{ID: 22, Name: "game_mode_all_draft", Balanced: true},
	{ID: 23, Name: "game_mode_turbo"},
	{ID: 24, Name: "game_mode_mutation"},
}
