import dotenv from "dotenv";
import { hasKeySet } from "./utils.js";

export interface BotEnvironment {
    API_KEY: string;
    CHAT_EMAIL: string;
    CHAT_PASSWORD: string;
    CHAT_ROOM: string;
    TENK_EMAIL: string;
    TENK_PASSWORD: string;
}

/**
 * @summary defaults an env var if not set
 * @param env dotenv parsed output
 * @param key one of the output keys
 * @param value default value to set
 */
export const defaultEnv = <
    T extends object,
    U extends keyof T
>(env: T, key: U, value: T[U]): T & { [P in U]-?: T[U] } => {
    if (hasKeySet(env, key)) return env;
    env[key] = value;
    return defaultEnv(env, key, value);
};

/**
 * @summary checks if all env vars are present
 * @param env bot environment variables
 */
export const validateEnv = (env: Partial<BotEnvironment>): env is BotEnvironment => {
    const requiredEnv: Array<keyof BotEnvironment> = [
        "TENK_EMAIL",
        "TENK_PASSWORD",
        "CHAT_EMAIL",
        "CHAT_PASSWORD",
        "CHAT_ROOM"
    ];

    return !requiredEnv.find((key) => !env[key]);
};

const { parsed } = dotenv.config();

const environment: Partial<BotEnvironment> = parsed || {};

export default environment;