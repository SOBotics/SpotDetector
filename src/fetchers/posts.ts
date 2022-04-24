import type { Post, Wrappers } from "@userscripters/stackexchange-api-types";
import lodash from "lodash";
import request from "request-promise-native";
import { getPosts, updatePost } from "../db.js";
import env from "../env.js";
import { getLatestTimelineEvent, parseTimeline } from "../parsers/timeline.js";
import { delay } from "../utils.js";
import Fetcher from "./index.js";

const TIMELINE_DELAY = 1500;
const STALE_DELETION = 3 * 24 * 60 * 60;

export default class PostFetcher extends Fetcher {

    /**
     * @summary fetches posts from the SE API
     * @param postIds post ids to fetch
     */
    async #fetchDeleted(postIds: number[]) {
        const key = env?.API_KEY;

        if (postIds.length === 0 || !key) {
            return [];
        }

        const idsSemi = postIds.join(";");

        const res: Wrappers.CommonWrapperObject<Post> = await request({
            uri: `https://api.stackexchange.com/2.3/posts/${idsSemi}`,
            qs: {
                pagesize: 100,
                key,
                site: "stackoverflow",
                filter: "!3tz1Wb9MFaV.ubMHe"
            },
            gzip: true,
            json: true
        });

        const { backoff, quota_remaining } = res;

        if (backoff) {
            console.log(`Got backoff, need to wait ${backoff} seconds`);
            await delay(backoff * 1000);
        } else if (quota_remaining && quota_remaining % 100 === 0) {
            console.log(`Quota remaining: ${quota_remaining}`);
        }

        await delay(250);

        const apiPosts = res.items.map(i => i.post_id);

        return postIds.filter(id => !apiPosts.includes(id));
    }

    async scrapeAll() {
        const { db, browser } = this;

        while (true) {
            try {
                const rows = await getPosts(db);

                const nowEpoch = new Date().getTime() / 1000;

                console.log(`Checking ${rows.length} posts for deletions`);

                for (const chunk of lodash.chunk(rows, 100)) {
                    const deleted = await this.#fetchDeleted(chunk.map(r => r.id));

                    for (const row of chunk) {
                        const { id, date } = row;

                        if (!deleted.includes(id)) {
                            if (date < nowEpoch - STALE_DELETION) {
                                // It's been 3 days. If it hasn't been deleted at this point, just ignore
                                await updatePost(db, id, { deleted: false });
                            }
                            continue;
                        }

                        console.log(`Scraping timeline for ${id}`);
                        const html = await browser.scrapeHTML(`/posts/${id}/timeline`);

                        const timeline = parseTimeline(html);

                        const latestDeletion = getLatestTimelineEvent(timeline, "deletions");
                        const latestUndeletion = getLatestTimelineEvent(timeline, "undeletions");
                        const isDeleted = latestDeletion && (!latestUndeletion || (latestDeletion.date > latestUndeletion.date));

                        // Check to make sure, question probably got nuked, in this case, I don't care that this was deleted
                        if (!isDeleted) {
                            if (date < nowEpoch - STALE_DELETION) {
                                // It's been 3 days. If it hasn't been deleted at this point, just ignore
                                await updatePost(db, id, { deleted: false });
                            }

                            await delay(TIMELINE_DELAY);
                            continue;
                        }

                        await updatePost(db, id, { deleted: true });

                        await delay(TIMELINE_DELAY);
                    }
                }
            } catch (err) {
                console.log(`Error checking posts: ${err}`);
            }

            console.log(`Done checking posts. Waiting 15 minutes for next round.`);
            await delay(15 * 60 * 1000);
        }
    }
}
