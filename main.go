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

var EnvSteamID string
var EnvDiscordURL string
var EnvPollTime int
var logger = log.New(os.Stdout, "- ", log.LstdFlags|log.Lmsgprefix)

func main() {
	err := godotenv.Load()
	if err != nil {
		logger.Println("No .env file found. Skipping...")
	}

	if env, exists := os.LookupEnv("STEAM_ID"); exists {
		EnvSteamID = env
	} else {
		logger.Fatal("Missing STEAM_ID env variable. Quitting...")
	}

	if env, exists := os.LookupEnv("DISCORD_URL"); exists {
		EnvDiscordURL = env
	} else {
		logger.Fatal("Missing DISCORD_URL env variable. Quitting...")
	}

	if env, exists := os.LookupEnv("POLL_TIME"); exists {
		if intValue, err := strconv.Atoi(env); err == nil {
			EnvPollTime = intValue
		} else {
			logger.Fatal("POLL_TIME failed to convert to int. Quitting...")
		}
	} else {
		logger.Fatal("Missing POLL_TIME env variable. Quitting...")
	}

	SteamID, err := convertSteam64to32(EnvSteamID)
	if err != nil {
		logger.Fatalf("Unable to get Steam ID from %s. Quitting...", EnvSteamID)
	}

	logger.Println("Aaron's Dota II Webhook")
	logger.Println("Fetching Inital Match...")

	recentMatches, err := fetchAPIRecentMatches(SteamID)
	if err != nil || len(recentMatches) < 1 { // Should always be one
		logger.Fatal("Error fetching first recent game. Exiting")
	}
	lastMatch := recentMatches[0]

	logger.Printf("Starting Event Loop - %d seconds\n", EnvPollTime)

	// Loop every EnvPollTime * second
	ticker := time.NewTicker(time.Duration(EnvPollTime) * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		recentMatches, err := fetchAPIRecentMatches(SteamID)
		if err != nil || len(recentMatches) < 1 { // Should always be one
			logger.Println("Unable to fetch recentMatch... skipping")
			continue
		}

		// Sort the matches in descending order by StartTime
		sort.Slice(recentMatches, func(i, j int) bool {
			return recentMatches[i].StartTime > recentMatches[j].StartTime
		})

		recentMatch := recentMatches[0]
		if recentMatch.StartTime <= lastMatch.StartTime {
			logger.Println("Not a new match... Ending eventloop...")
			continue
		}
		// Set new match
		lastMatch = recentMatch
		logger.Printf("New match %d", recentMatch.MatchID)

		// Fetch stuff
		matchDetail, err := fetchAPIMatchDetails(recentMatch.MatchID)
		if err != nil {
			logger.Println(err)
			continue
		}

		profile, err := fetchAPIPlayer(SteamID)
		if err != nil {
			logger.Println(err)
			continue
		}

		hero, found := GetHeroById(recentMatch.HeroID)
		if !found {
			logger.Println(err)
			continue
		}

		sendDiscordNotification(recentMatch, matchDetail, hero, profile)
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

func sendDiscordNotification(match RecentMatchGames, matchDetail MatchDetails, hero Hero, profile Profile) {
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

	var gamemode string
	if gm, found := GetGameModeById(match.GameMode); found {
		gamemode = toTitleCase(gm.Name)
	} else {
		gamemode = "Unknown"
	}

	var facetTitle string
	if fc, found := GetFacetByHeroAndVariant(hero.ID, match.HeroVariant); found {
		facetTitle = fc.Title
	} else {
		facetTitle = "Unknown"
	}

	// Could be a own function...
	webhook := DiscordWebhook{
		Username: "Dota Tracker (v4.1)",
		Embeds: []Embed{
			{
				Title:       fmt.Sprintf("Match #%d", match.MatchID),
				Color:       embedColor,
				URL:         fmt.Sprintf("https://www.opendota.com/players/%d", profile.AccountID),
				Description: descriptionText,
				Footer: EmbedFooter{
					// Text: getTimeNowWithTZ().Format("Mon, Jan 2, 2006, 3:04 PM"),
					Text: "Dota v" + GetLatestPatch().Name + " - Now with Facets ❤️",
				},
				Author: EmbedAuthor{
					Name:    personaName,
					IconURL: avatar,
					URL:     fmt.Sprintf("https://www.opendota.com/matches/%d", match.MatchID),
				},
				Thumbnail: EmbedThumbnail{
					URL: fmt.Sprintf("https://cdn.cloudflare.steamstatic.com%s", hero.Img),
				},
				Fields: []EmbedField{
					{
						Name: "Stats",
						Value: fmt.Sprintf(
							"Hero: %s\n"+
								"Facet: %s\n"+
								"K/D/A: %d/%d/%d\n"+
								"XPM: %d\n"+
								"GPM: %d\n",
							hero.LocalizedName,
							facetTitle,
							match.Kills, match.Deaths, match.Assists,
							match.XPPerMin,
							match.GoldPerMin),
						Inline: true,
					},
					{
						Name: "Performance",
						Value: fmt.Sprintf(
							"Hero Damage: %s\n"+
								"Tower Damage: %s\n"+
								"Hero Healing: %s\n"+
								"Last hits: %d",
							formatWithSuffix(match.HeroDamage),
							formatWithSuffix(match.TowerDamage),
							formatWithSuffix(match.HeroHealing),
							match.LastHits),
						Inline: true,
					},
					{
						Name: "Match Details",
						Value: fmt.Sprintf(
							"Game Mode: %s\n"+
								"Duration: %s\n"+
								"Start Time: %s",
							gamemode,
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
		logger.Println("Unable to send Webhook:", err)
	} else {
		logger.Println("Webhook Successfully Sent")
	}

	defer resp.Body.Close()
}
