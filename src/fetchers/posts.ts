import lodash from "lodash";
import { getPosts, updatePost } from "../db.js";
import { getLatestTimelineEvent, parseTimeline, PostTimeline } from "../parsers/timeline.js";
import { delay } from "../utils.js";
import Fetcher from "./index.js";

const TIMELINE_DELAY = 2000;

export default class PostFetcher extends Fetcher {

    /**
     * @summary scrapes timeline of a given post
     * @param id id of the post to scrape
     */
    async scrape(id: number): Promise<PostTimeline> {
        const { browser, db } = this;

        console.log(`[${id}] scraping timeline`);

        const html = await browser.scrapeHTML(`/posts/${id}/timeline`);
        const timeline = parseTimeline(html);

        const latestDeletion = getLatestTimelineEvent(timeline, "deletions");
        const latestUndeletion = getLatestTimelineEvent(timeline, "undeletions");
        const deleted = latestDeletion && (!latestUndeletion || (latestDeletion.date > latestUndeletion.date));

        await updatePost(db, id, { deleted, user_id: +timeline.userId });
        await delay(TIMELINE_DELAY);

        console.log(`[${id}] finished scraping timeline`);
        return timeline;
    }

    /**
     * @summary scrapes timelines of all posts
     */
    async scrapeAll(): Promise<void> {
        const { db } = this;

        const NEXT_ROUND_DELAY = 15;

        try {
            const posts = await getPosts(db);

            for (const chunk of lodash.chunk(posts, 100)) {
                for (const post of chunk) {
                    await this.scrape(post.id);
                }
            }
        } catch (err) {
            console.log(`[posts] scraping error: ${err}`);
        }

        console.log(`[posts] finished scraping (${NEXT_ROUND_DELAY} min to next round)`);
        await delay(NEXT_ROUND_DELAY * 60 * 1000);

        return this.scrapeAll();
    }
}
