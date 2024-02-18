package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
)

type Player struct {
	LeaderBoardRank     *int64  `json:"leaderboard_rank"`
	Profile             Profile `json:"profile"`
	SoloCompetitiveRank *int64  `json:"solo_competitive_rank"`
	CompetitiveRank     *int64  `json:"competitive_rank"`
	RankTier            *int64  `json:"rank_tier"`
}

type Profile struct {
	AccountID   int64   `json:"account_id"`
	PersonaName *string `json:"personaname"`
	Name        *string `json:"name"`
	Plus        bool    `json:"plus"`
	Cheese      *int64  `json:"cheese"`
	SteamID     *string `json:"string"`
	Avatar      *string `json:"avatar"`
}

type Hero struct {
	Name          string   `json:"name"`
	ID            int      `json:"id"`
	LocalizedName string   `json:"localized_name"`
	PrimaryAttr   string   `json:"primary_attr"`
	AttackType    string   `json:"attack_type"`
	Roles         []string `json:"roles"`
}

type HeroStat struct {
	Id            int    `json:"id"`
	Name          string `json:"name"`
	Localizedname string `json:"localized_name"`
	Img           string `json:"img"`
}

// Match represents the structure of an individual match with all possible fields.
type RecentMatchGames struct {
	MatchID     int64 `json:"match_id"`
	PlayerSlot  int   `json:"player_slot"`
	RadiantWin  bool  `json:"radiant_win"`
	HeroID      int   `json:"hero_id"`
	StartTime   int64 `json:"start_time"`
	Duration    int   `json:"duration"`
	GameMode    int   `json:"game_mode"`
	Kills       int   `json:"kills"`
	Deaths      int   `json:"deaths"`
	Assists     int   `json:"assists"`
	XPPerMin    int   `json:"xp_per_min"`
	GoldPerMin  int   `json:"gold_per_min"`
	HeroDamage  int   `json:"hero_damage"`
	TowerDamage int   `json:"tower_damage"`
	HeroHealing int   `json:"hero_healing"`
	LastHits    int   `json:"last_hits"`
}

type MatchDetails struct {
	MatchID      int64 `json:"match_id"`
	DireScore    int16 `json:"dire_score"`
	RadiantScore int16 `json:"radiant_score"`
}

func findHeroImgById(heroStats []HeroStat, heroId int) (string, bool) {
	for _, hero := range heroStats {
		if hero.Id == heroId {
			return hero.Img, true // Hero found, return img and true
		}
	}
	return "", false // Hero not found, return empty string and false
}

func convertSteam64to32(steam64 string) (string, error) {
	steamIDBigInt := new(big.Int)
	steamIDBigInt, ok := steamIDBigInt.SetString(steam64, 10) // base 10
	if !ok {
		logger.Println("Failed to parse steam64")
		return "", errors.New("failed to parse steam64")
	}

	offset := new(big.Int)
	offset.SetString("76561197960265728", 10) // base 10

	realSteamID := new(big.Int).Sub(steamIDBigInt, offset)
	realSteamIDStr := realSteamID.String()
	return realSteamIDStr, nil
}

func fetchJSON(url string, target interface{}) error {
	resp, err := http.Get(url)
	if err != nil {
		logger.Println(err)
		return errors.New("failed to fetch Data")
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		logger.Println(err)
		return errors.New("failed to read body")
	}

	if err := json.Unmarshal(body, target); err != nil {
		logger.Println(err)
		logger.Println(body)
		return errors.New("failed to unmarshal body")
	}

	return nil
}

func fetchAPIPlayer(SteamID string) (Profile, error) {
	url := fmt.Sprintf("https://api.opendota.com/api/players/%s", SteamID)
	var player Player

	if err := fetchJSON(url, &player); err != nil {
		return Profile{}, err
	}

	return player.Profile, nil
}

func fetchAPIHeroArray(hero_id int) (Hero, error) {
	url := "https://api.opendota.com/api/heroes"

	// Fetch Recent Match - TODO: Make a function
	var heroes []Hero
	if err := fetchJSON(url, &heroes); err != nil {
		return Hero{}, err
	}

	for _, hero := range heroes {
		if hero.ID == hero_id {
			return hero, nil
		}
	}

	return Hero{}, errors.New("failed to find Hero via id")
}

func fetchAPIHeroStatsArray() ([]HeroStat, error) {
	url := "https://api.opendota.com/api/heroStats"
	var heroes []HeroStat

	if err := fetchJSON(url, &heroes); err != nil {
		return []HeroStat{}, err
	}

	return heroes, nil
}

func fetchAPIMatchDetails(MatchID int64) (MatchDetails, error) {
	url := fmt.Sprintf("https://api.opendota.com/api/matches/%d", MatchID)
	// Fetch Match Details - TODO: Make a function
	var match MatchDetails

	if err := fetchJSON(url, &match); err != nil {
		return MatchDetails{}, err
	}

	return match, nil
}

func fetchAPIRecentMatches(SteamID string) ([]RecentMatchGames, error) {
	url := fmt.Sprintf("https://api.opendota.com/api/players/%s/recentMatches", SteamID)
	var matches []RecentMatchGames

	if err := fetchJSON(url, &matches); err != nil {
		return []RecentMatchGames{}, err
	}

	return matches, nil
}
