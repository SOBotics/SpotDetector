import dotenv from "dotenv";
import { hasKeySet } from "./utils.js";

export interface BotEnvironment {
    API_KEY: string;
    CHAT_EMAIL: string;
    CHAT_PASSWORD: string;
    CHAT_ROOM: string;
    REPORT_DAYS: number;
    REPORT_REVIEWS: number;
    REPORT_USER: number;
    STACKAPPS_POST?: number;
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
 * @summary defaults all env vars specified
 * @param env dotenv parsed output
 * @param init value initializers
 */
export const defaultAll = <
    T extends object,
    U extends keyof T
>(env: T, init: { [P in U]: T[P] }): T & { [P in U]-?: T[P] } => {
    return Object.entries(init).reduce(
        (_, [k, v]) => defaultEnv(env, k as keyof T, v as T[keyof T]),
        env as any
    );
};

/**
 * @summary parses boolean and numeric env vars
 * @param env dotenv parsed output
 */
export const parseEnv = <T extends Record<string, unknown>>(env: { [P in keyof T]: string }): { [P in keyof typeof env]: T[P] } => {
    const output: Record<string, string | boolean | number> = {};

    Object.entries(env).forEach(([k, v]) => {
        if (v === "true") return output[k] = true;
        if (v === "false") return output[k] = false;
        if (!Number.isNaN(+v)) return output[k] = +v;
    });

    return output as any;
};

/**
 * @summary checks if all env vars are present
 * @param env bot environment variables
 */
export const validateEnv = (env: Partial<BotEnvironment>): env is BotEnvironment => {
    const requiredEnv: Array<keyof BotEnvironment> = [
        "TENK_EMAIL",
        "TENK_PASSWORD",
        "REPORT_USER",
        "CHAT_EMAIL",
        "CHAT_PASSWORD",
        "CHAT_ROOM"
    ];

    return !requiredEnv.find((key) => !env[key]);
};

const { parsed } = dotenv.config();

const environment = parseEnv<Partial<BotEnvironment>>(parsed || {});

const defaulted = defaultAll(environment, {
    STACKAPPS_POST: 8091,
    REPORT_DAYS: 8,
    REPORT_REVIEWS: 4
});

export default defaulted;