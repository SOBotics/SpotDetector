import { chunk as arrayChunk } from "lodash";
import request from "request-promise-native";
import { SQL } from "sql-template-strings";
import env from "./env";
import { delay } from "./utils";

const DUPLICATE_REGEX = /meta\.stackexchange\.com\/q\/104227/i;
const TIMELINE_DELAY = 1500;
const STALE_DELETION = 3 * 24 * 60 * 60;

const parseTimeline = $ =>
  $(".event-rows tr:not(.separator)")
    .toArray()
    .reduce(
      (arr, row) => {
        const id = $(row).data("eventid");
        const eventtype = $(row).data("eventtype");
        const verb = $(row)
          .find(".event-verb span")
          .text()
          .trim();

        switch (eventtype) {
          case "history":
            switch (verb) {
              case "asked":
              case "answered":
                const userA = $(row).find(".created-by a");
                let userId;

                if (userA.length > 0) {
                  userId = userA.attr("href").split("/")[2];
                } else {
                  userId = $(row)
                    .find(".created-by")
                    .text()
                    .trim();
                }

                if (
                  arr.deleted &&
                  arr.deletedBy.includes(userId) &&
                  arr.deleteReason !== "duplicate"
                ) {
                  arr.deleteReason = userId.startsWith("user")
                    ? "self_nuked"
                    : "self";
                }
                break;
              case "post deleted from review":
                if (arr.deleted === null) {
                  arr.deleteReason = "review";
                  arr.deleted = true;
                }
                break;
              case "deleted":
                if (arr.deleted === null) {
                  arr.deleted = true;

                  if (arr.deleteReason !== "duplicate") {
                    if ($(row).find(".created-by .mod-flair").length > 0) {
                      if (
                        $(row)
                          .find(".event-comment span")
                          .text()
                          .trim() === "Converted to Comment"
                      ) {
                        arr.deleteReason = "diamond_mod_convert";
                      } else {
                        arr.deleteReason = "diamond_mod";
                      }
                    } else {
                      arr.deleteReason = "reputation_mod";
                    }
                  }

                  const userAs = $(row).find(".created-by a");

                  arr.deletedBy = [
                    ...userAs
                      .map(
                        (_, el) =>
                          $(el)
                            .attr("href")
                            .split("/")[2]
                      )
                      .toArray(),
                    ...(userAs.length
                      ? []
                      : [
                          $(row)
                            .find(".created-by")
                            .text()
                            .trim()
                        ])
                  ];
                }
                break;
              case "undeleted":
                if (arr.deleted === null) {
                  arr.deleted = false;
                }
                break;
            }
            break;
          case "comment":
            const comment = $(row)
              .find(".event-comment span")
              .html();
            if (DUPLICATE_REGEX.test(comment)) {
              arr.deleteReason = "duplicate";
            }
          case "review":
            if ($(row).hasClass("deleted-event")) {
              const a = $(row).find(".event-verb span a");
              const link = a.attr("href");
              const reviewType = a.text().trim();

              switch (reviewType) {
                case "late answer":
                case "first post":
                  arr.reviews[id] = {
                    id,
                    link,
                    type: reviewType
                  };
                  break;
              }
            } else if (
              $(row).hasClass("deleted-event-details") &&
              typeof arr.reviews[id] !== "undefined"
            ) {
              const comment = $(row)
                .find(".event-comment span")
                .text()
                .trim();

              arr.reviews[id].result = comment.replace(/ × 1$/, "");
            }
            break;
        }

        return arr;
      },
      {
        deleted: null,
        deletedBy: [],
        reviews: {}
      }
    );

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
