import dotenv from "dotenv";

export interface BotEnvironment {
    API_KEY: string;
    CHAT_EMAIL: string;
    CHAT_PASSWORD: string;
    CHAT_ROOM: string;
    TENK_EMAIL: string;
    TENK_PASSWORD: string;
}

const { parsed } = dotenv.config();

const environment: Partial<BotEnvironment> = parsed || {};

export default environment;