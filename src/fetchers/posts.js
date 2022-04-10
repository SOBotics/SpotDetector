import { chunk as arrayChunk } from "lodash";
import request from "request-promise-native";
import { SQL } from "sql-template-strings";
import env from "../env";
import { parseTimeline } from "../parsers/timeline.js";
import { delay } from "../utils";

const TIMELINE_DELAY = 1500;
const STALE_DELETION = 3 * 24 * 60 * 60;

export default class PostFetcher {
  constructor(db, browser) {
    this._db = db;
    this._browser = browser;
    this._backoff = 0;
  }

  /**
   * Perform an update on the posts provided, updating them to deleted/undeleted
   *
   * @param {number[]} postIds The post ids to update/search
   * @param {boolean} updateNonDeleted True to update posts as "Non Deleted" - Prevent them from being searched/updated again
   * @returns
   * @memberof PostFetcher
   */
  async _fetchDeleted(postIds) {
    if (postIds.length === 0) {
      return [];
    }

    const idsSemi = postIds.join(";");

    const res = await request({
      uri: `https://api.stackexchange.com/2.2/posts/${idsSemi}`,
      qs: {
        pagesize: 100,
        key: env.API_KEY,
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
    while (true) {
      try {
        //datetime(date, 'unixepoch') >= datetime('now','-3 days') AND
        const rows = await this._db.all(`
          SELECT p.*, r.date
          FROM posts p
          LEFT JOIN reviews r ON p.id = r.post_id
          WHERE r.review_result IN ('No Action Needed', 'Looks OK')
          AND p.deleted IS NULL
          GROUP BY p.id
          ORDER BY r.date DESC
        `);

        const nowEpoch = new Date().getTime() / 1000;

        console.log(`Checking ${rows.length} posts for deletions`);

        for (const chunk of arrayChunk(rows, 100)) {
          const deleted = await this._fetchDeleted(chunk.map(r => r.id));

          for (const row of chunk) {
            if (!deleted.includes(row.id)) {
              if (row.date < nowEpoch - STALE_DELETION) {
                // It's been 3 days. If it hasn't been deleted at this point, just ignore
                await this._db.run(SQL`
                  UPDATE posts
                  SET deleted = 0, delete_reason = NULL
                  WHERE id = ${row.id}
                `);
              }
              // console.log(`${row.post_id} is not deleted! Continuing on.`);
              continue;
            }

            console.log(`Scraping timeline for ${row.id}`);
            const html = await this._browser.scrapeHtml(
              `/posts/${row.id}/timeline`
            );

            const timeline = parseTimeline(html);

            // Check to make sure, question probably got nuked, in this case, I don't care that this was deleted
            if (!timeline.deleted) {
              if (row.date < nowEpoch - STALE_DELETION) {
                // It's been 3 days. If it hasn't been deleted at this point, just ignore
                await this._db.run(SQL`
                  UPDATE posts
                  SET deleted = 0, delete_reason = NULL
                  WHERE id = ${row.id}
                `);
              }

              await delay(TIMELINE_DELAY);
              continue;
            }

            await this._db.run(SQL`
                            UPDATE posts
                            SET deleted = 1, delete_reason = ${timeline.deleteReason ||
                              null}
                            WHERE id = ${row.id}
                        `);

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
