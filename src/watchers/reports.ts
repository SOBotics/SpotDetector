import type Room from "chatexchange/dist/Room";
import cron from "node-cron";
import type { Database } from "sqlite";
import type Browser from "../browser.js";
import generate from "../reports/index.js";
import Watcher from "./index.js";

export interface ReportWatcherConfig {
    days: number;
    reviews: number;
    stackapps: string;
    username: string;
}

export default class ReportWatcher extends Watcher {

    #config: ReportWatcherConfig;

    constructor(browser: Browser, db: Database, room: Room, config: ReportWatcherConfig) {
        super(browser, db, room);

        this.#config = config;
    }

    /**
     * @summary starts watching reports
     */
    async watch(cronExpression: string) {
        const { db, room } = this;

        const { days, reviews, stackapps, username } = this.#config;

        cron.schedule(
            cronExpression,
            async () => {
                const report = await generate(db, days, reviews);
                if (!report) return;

                const { users, url } = report;

                await room.sendMessage(
                    `[ ${stackapps} ] @${username} Your [${days}-day report](${url}) has arrived. ${users} user${users === 1 ? "" : "s"
                    } found matching ${reviews} or more possible bad reviews.`
                );
            },
            {
                timezone: "Etc/UTC"
            }
        );
    }
}