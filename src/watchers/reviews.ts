import type Room from "chatexchange/dist/Room";
import cron from "node-cron";
import type { Database } from "sqlite";
import { getSuggestedEdits } from "../api.js";
import type Browser from "../browser.js";
import { ReviewType } from "../fetchers/index.js";
import PostFetcher from "../fetchers/posts.js";
import { reportPotentiallyBadSuggestedEditsReview } from "../reports/reviews.js";
import Watcher from "./index.js";

export interface SuggestedEditsWatcherConfig {
    hours?: number;
    key: string;
    site?: string;
}

export default class SuggestedEditsWatcher extends Watcher {

    #config: SuggestedEditsWatcherConfig;

    constructor(browser: Browser, db: Database, room: Room, config: SuggestedEditsWatcherConfig) {
        super(browser, db, room);

        this.#config = config;
    }

    /**
     * @summary starts watching reports
     * @param cronExpression cron schedule
     * @param immediately run the job before scheduling?
     */
    async watch(cronExpression: string, immediately?: boolean) {
        const { browser, db, room } = this;

        const { hours = 1, key, site } = this.#config;

        const from = Date.now() - hours * 60 * 60 * 1e3;

        const fetcher = new PostFetcher(browser, db);

        const job = async () => {
            console.log(`[${ReviewType.SE} watcher] job started`);

            const edits = await getSuggestedEdits("rejected", "post_id", { from, key, site });

            console.log(`[${ReviewType.SE} watcher] edits found: ${edits.size}`);

            for (const [postId, { comment, post_type, suggested_edit_id }] of edits) {

                // get the real task id
                const { href } = await browser.follow(`/suggested-edits/${suggested_edit_id}`);
                const [taskId] = /(?<=suggested-edits\/)\d+(?=.*$)/.exec(href) || [];

                const { reviews } = await fetcher.scrape(postId);

                const suggestions = Object.values(reviews).filter(({ type }) => type === ReviewType.SE);

                // TODO: make review lookup easier
                const review = suggestions.find(({ link }) => link.includes(taskId.toString()));
                if (!review) continue;

                const { votes: { approve, reject }, link } = review;

                if (reject === 2 && approve === 1) {
                    await reportPotentiallyBadSuggestedEditsReview(browser, room, {
                        comment, link, post_type
                    });
                }
            }

            console.log(`[${ReviewType.SE} watcher] job finished`);
        };

        if (immediately) {
            await job();
        }

        cron.schedule(cronExpression, job);
    }
}