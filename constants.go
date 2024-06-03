package main

/*
Dota II Constants from https://github.com/odota/dotaconstants
*/

import (
	_ "embed"
	"encoding/json"
	"strconv"
	"time"
)

type Hero struct {
	ID              int      `json:"id"`
	Name            string   `json:"name"`
	PrimaryAttr     string   `json:"primary_attr"`
	AttackType      string   `json:"attack_type"`
	Roles           []string `json:"roles"`
	Img             string   `json:"img"`
	Icon            string   `json:"icon"`
	BaseHealth      int      `json:"base_health"`
	BaseHealthRegen float64  `json:"base_health_regen"`
	BaseMana        int      `json:"base_mana"`
	BaseManaRegen   float64      `json:"base_mana_regen"`
	BaseArmor       int      `json:"base_armor"`
	BaseMr          int      `json:"base_mr"`
	BaseAttackMin   int      `json:"base_attack_min"`
	BaseAttackMax   int      `json:"base_attack_max"`
	BaseStr         int      `json:"base_str"`
	BaseAgi         int      `json:"base_agi"`
	BaseInt         int      `json:"base_int"`
	StrGain         float64  `json:"str_gain"`
	AgiGain         float64  `json:"agi_gain"`
	IntGain         float64  `json:"int_gain"`
	AttackRange     int      `json:"attack_range"`
	ProjectileSpeed int      `json:"projectile_speed"`
	AttackRate      float64  `json:"attack_rate"`
	BaseAttackTime  int      `json:"base_attack_time"`
	AttackPoint     float64  `json:"attack_point"`
	MoveSpeed       int      `json:"move_speed"`
	TurnRate        any      `json:"turn_rate"`
	CmEnabled       bool     `json:"cm_enabled"`
	Legs            int      `json:"legs"`
	DayVision       int      `json:"day_vision"`
	NightVision     int      `json:"night_vision"`
	LocalizedName   string   `json:"localized_name"`
}

/*
	Hero Abilites
*/
type Talent struct {
	Name  string `json:"name"`
	Level int    `json:"level"`
}

type Facet struct {
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	GradientID  int    `json:"gradient_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

type HeroAbilites struct {
	Abilities []string `json:"abilities"`
	Talents   []Talent `json:"talents"`
	Facets    []Facet  `json:"facets"`
}

type GameMode struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Balanced bool   `json:"balanced"`
}

type Patch struct {
	Name string    `json:"name"`
	Date time.Time `json:"date"`
	ID   int       `json:"id"`
}

//go:embed constants/heroes.json
var herosData []byte
var herosDataMap map[string]json.RawMessage

//go:embed constants/hero_abilities.json
var heroAbilitesData []byte
var heroAbilitesDataMap map[string]json.RawMessage

//go:embed constants/game_mode.json
var gameModeData []byte
var gameModeDataMap map[string]json.RawMessage

//go:embed constants/patch.json
var patchData []byte
var patchDataArr []Patch

func init() {
	// Heros
	if err := json.Unmarshal(herosData, &herosDataMap); err != nil {
		panic(err)
	}

	// Hero Abilites
	if err := json.Unmarshal([]byte(heroAbilitesData), &heroAbilitesDataMap); err != nil {
		panic(err)
	}

	// Gamemodes
	if err := json.Unmarshal([]byte(gameModeData), &gameModeDataMap); err != nil {
		panic(err)
	}

	// Patches
	if err := json.Unmarshal([]byte(patchData), &patchDataArr); err != nil {
		panic(err)
	}
}

func GetHeroById(id int) (hero Hero, found bool) {
		for HeroIDStr, v := range herosDataMap {
			HeroID, err := strconv.Atoi(HeroIDStr)
			if err != nil {
				panic(err)
			}

			if id == HeroID {
				var hero Hero
				if err := json.Unmarshal(v, &hero); err != nil {
					panic(err)
				}
				return hero, true
			}
		}
		return Hero{}, false
}

func GetHeroAbilitesByName(name string) (heroAbilites HeroAbilites, found bool) {
	for heroName, v := range heroAbilitesDataMap {
		if name == heroName {
			var heroAbilites HeroAbilites
			if err := json.Unmarshal(v, &heroAbilites); err != nil {
				panic(err)
			}
			return heroAbilites, true
		}
	}
	return HeroAbilites{}, false
}

// TODO Add Hero_Variant
func GetFacetByHeroAndVariant (id int, facetIndex int) (facet Facet, found bool) {
	for HeroIDStr, v := range herosDataMap {
		HeroID, err := strconv.Atoi(HeroIDStr)
		if err != nil {
				panic(err)
		}

		if id != HeroID {
			continue
		}

		var hero Hero
		if err := json.Unmarshal(v, &hero); err != nil {
			panic(err)
		}

		heroAbilites, found := GetHeroAbilitesByName(hero.Name)
		if !found {
			panic("Unable to locate heroAbilities: " + hero.Name)
		}

		if facetIndex > len(heroAbilites.Facets) || facetIndex < 1 {
			return Facet{}, false
		}

		return heroAbilites.Facets[facetIndex - 1], true
	}

	return Facet{}, false
}

func GetGameModeById(id int) (gameMode GameMode, found bool) {
	for GameModeStr, v := range gameModeDataMap {
		GameModeID, err := strconv.Atoi(GameModeStr)
		if err != nil {
			panic(err)
		}

		if id == GameModeID {
			var gameMode GameMode
			if err := json.Unmarshal(v, &gameMode); err != nil {
				panic(err)
			}
			return gameMode, true
		}
	}
	return GameMode{}, false
}

func GetLatestPatch() Patch {
	return patchDataArr[len(patchDataArr)-1]
}


