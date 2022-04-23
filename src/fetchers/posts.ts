import type { Post, Wrappers } from "@userscripters/stackexchange-api-types";
import lodash from "lodash";
import request from "request-promise-native";
import { getPosts, updatePost } from "../db.js";
import env from "../env.js";
import { parseTimeline } from "../parsers/timeline.js";
import { delay } from "../utils.js";
import Fetcher from "./index.js";

const TIMELINE_DELAY = 1500;
const STALE_DELETION = 3 * 24 * 60 * 60;

export enum PostType {
    A = "answer",
    Q = "question"
}

export default class PostFetcher extends Fetcher {

    /**
     * @summary Perform an update on the posts provided, updating them to deleted/undeleted
     * @param postIds The post ids to update/search
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

        if (res.backoff) {
            console.log(`Got backoff, need to wait ${res.backoff} seconds`);
            await delay(res.backoff * 1000);
        } else if (res.quota_remaining && res.quota_remaining % 100 === 0) {
            console.log(`Quota remaining: ${res.quota_remaining}`);
        }

        await delay(250);

        const apiPosts = res.items.map(i => i.post_id);

        // console.log(`Chunk completed: ${postIds.length-apiPosts.length} deleted posts found.`);

        return postIds.filter(id => !apiPosts.includes(id));
    }

    async scrape() {
        const { db } = this;

        while (true) {
            try {
                //datetime(date, 'unixepoch') >= datetime('now','-3 days') AND
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
                            // console.log(`${row.post_id} is not deleted! Continuing on.`);
                            continue;
                        }

                        console.log(`Scraping timeline for ${id}`);
                        const html = await this.browser.scrapeHTML(
                            `/posts/${id}/timeline`
                        );

                        const timeline = parseTimeline(html);

                        // Check to make sure, question probably got nuked, in this case, I don't care that this was deleted
                        // @ts-ignore
                        if (!timeline.deleted) {
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
