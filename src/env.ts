import dotenv from "dotenv";

export interface BotEnvironment {
    API_KEY: string;
    CHAT_EMAIL: string;
    CHAT_PASSWORD: string;
    CHAT_ROOM: string;
    TENK_EMAIL: string;
    TENK_PASSWORD: string;
}

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