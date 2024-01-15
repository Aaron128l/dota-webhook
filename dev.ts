import env from "./env.js"

Object.assign(process.env, env)

type ENV = typeof env

export interface ProcessEnv extends ENV {}
