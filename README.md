# Dota Webhook

A Dota 2 game tracker that uses [OpenDota](https://www.opendota.com/) posting Discord Webhooks.

## Key Features

Template from [dayblox/node-ts](https://github.com/dayblox/node-ts).

- [<img src="https://user-images.githubusercontent.com/17180392/211619716-8630ae1a-e5ea-424f-87a6-f3188edae821.svg" height=19.2 align=center /> TypeScript](https://www.typescriptlang.org/)
- [<img src="https://user-images.githubusercontent.com/124377191/228204788-98a151c8-fc70-4dac-a966-4be6513aafc6.png" height=19.2 align=center /> Node.js](https://nodejs.org/)
- [<img src="https://user-images.githubusercontent.com/124377191/228203400-d65b9566-d92e-48b1-9b46-9aa95c05fb21.svg" height=19.2 align=center /> esbuild](https://esbuild.github.io/)
- [<img src="https://github-production-user-asset-6210df.s3.amazonaws.com/17180392/266780371-74b32ff7-5cc3-45e1-af80-923a05c9f87b.svg" height=19.2 align=center /> Biome](https://biomejs.dev/)
- [<img src="https://user-images.githubusercontent.com/124377191/228447757-78408c15-e914-4fb3-9135-f1ff45ee3fce.svg" height=19.2 align=center /> GitHub](https://github.com)

## Prerequisites

- [<img src="https://user-images.githubusercontent.com/124377191/228203877-9975d517-140a-491d-80f5-9cca049143a6.svg" height=19.2 align=center /> pnpm](https://pnpm.io/installation) `>=7.27.0`
- [<img src="https://user-images.githubusercontent.com/124377191/228204788-98a151c8-fc70-4dac-a966-4be6513aafc6.png" height=19.2 align=center /> Node.js](https://nodejs.org/) `>=16.11.0`

## Getting Started

1.  **Clone** the repository

2.  **Install** dependencies

    ```sh
    pnpm i
    ```

3.  Create environment file `env.ts` at the root

    ```ts
    export default {
      // Steam ID - steamID64
      STEAMID: "32564195046378881",
      // Discord Webhook
      DISCORD_ID: "424282193671420215",
      DISCORD_TOKEN: "ab7jgaE2c_9Utu2-RDxGM0DDI39RVxv329Oq36k",
      // Optional Poll Time - Every 5 minutes
      POLL_TIME_SECONDS: 300,
    };
    ```

    #

    Using `zod` typechecking:

    ```ts
    import { z } from "zod";

    z.object({
      STEAMID: z.string(),
      DISCORD_ID: z.string(),
      DISCORD_TOKEN: z.string(),
      POLL_TIME_SECONDS: z.coerce.number().optional(),
    });
    ```

## Usage

- **Development** mode (**debug**)

  ```sh
  pnpm dev
  ```

- **Production** build

  ```sh
  pnpm build && pnpm start
  ```
