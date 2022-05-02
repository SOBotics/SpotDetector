import type Room from "chatexchange/dist/Room";
import type { Database } from "sqlite";
import type Browser from "../browser.js";

export default abstract class Watcher {
    constructor(
        protected browser: Browser,
        protected db: Database,
        protected room: Room
    ) { }

    abstract watch(cronExpression: string): Promise<void>;
}