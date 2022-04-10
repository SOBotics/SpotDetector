import type { Database } from "sqlite";
import type Browser from "../Browser.js";

export default abstract class Fetcher {
    /**
     * @summary creates an instance of {@link Fetcher}
     * @param browser {@link Browser} instance for low-level operations
     * @param db {@link Database} instance for SQLite operations
     */
    constructor(protected browser: Browser, protected db: Database) { }

    abstract scrape(): Promise<void>;
}