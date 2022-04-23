import type { Database } from "sqlite";
import type Browser from "../browser.js";

export enum PostType {
    A = "answer",
    Q = "question"
};

export enum ReviewType {
    CV = "close-votes",
    RV = "reopen-votes",
    LQA = "low-quality-answers",
    SE = "suggested-edits",
    FA = "first-answers",
    FQ = "first-questions",
    LA = "late-answers",
    T = "triage"
};

export default abstract class Fetcher {
    /**
     * @summary creates an instance of {@link Fetcher}
     * @param browser {@link Browser} instance for low-level operations
     * @param db {@link Database} instance for SQLite operations
     */
    constructor(protected browser: Browser, protected db: Database) { }

    abstract scrapeAll(): Promise<void>;
}