export enum GameModeType {
  Unknown = 0,
}

export interface GameMode {
  id: number | GameModeType
  name: string
  balanced?: boolean
}

export const GameModes: GameMode[] = [
  {
    id: 0,
    name: "game_mode_unknown",
    balanced: true,
  },
  {
    id: 1,
    name: "game_mode_all_pick",
    balanced: true,
  },
  {
    id: 2,
    name: "game_mode_captains_mode",
    balanced: true,
  },
  {
    id: 3,
    name: "game_mode_random_draft",
    balanced: true,
  },
  {
    id: 4,
    name: "game_mode_single_draft",
    balanced: true,
  },
  {
    id: 5,
    name: "game_mode_all_random",
    balanced: true,
  },
  {
    id: 6,
    name: "game_mode_intro",
  },
  {
    id: 7,
    name: "game_mode_diretide",
  },
  {
    id: 8,
    name: "game_mode_reverse_captains_mode",
  },
  {
    id: 9,
    name: "game_mode_greeviling",
  },
  {
    id: 10,
    name: "game_mode_tutorial",
  },
  {
    id: 11,
    name: "game_mode_mid_only",
  },
  {
    id: 12,
    name: "game_mode_least_played",
    balanced: true,
  },
  {
    id: 13,
    name: "game_mode_limited_heroes",
  },
  {
    id: 14,
    name: "game_mode_compendium_matchmaking",
  },
  {
    id: 15,
    name: "game_mode_custom",
  },
  {
    id: 16,
    name: "game_mode_captains_draft",
    balanced: true,
  },
  {
    id: 17,
    name: "game_mode_balanced_draft",
    balanced: true,
  },
  {
    id: 18,
    name: "game_mode_ability_draft",
  },
  {
    id: 19,
    name: "game_mode_event",
  },
  {
    id: 20,
    name: "game_mode_all_random_death_match",
  },
  {
    id: 21,
    name: "game_mode_1v1_mid",
  },
  {
    id: 22,
    name: "game_mode_all_draft",
    balanced: true,
  },
  {
    id: 23,
    name: "game_mode_turbo",
  },
  {
    id: 24,
    name: "game_mode_mutation",
  },
] as const
