import { SQL } from 'sql-template-strings';
import { delay } from '../utils';
import Fetcher from './index.js';

export default class PostFetcher extends Fetcher {

    async _scrapeReviews(reviewType) {
        let page = 0;
        let reviewCount = 0;

        let latestReview = await this._db.get(SQL`
            SELECT review_id, user_id
            FROM reviews
            WHERE review_type = ${reviewType}
            ORDER BY date DESC
            LIMIT 1
        `);

        if (typeof latestReview === 'undefined') {
            latestReview = {
                review_id: null,
                user_id: null,
            };
        }


        while (true) {
            page++;

            // Sanity check!
            if (page > 3000) {
                break;
            }

            console.log(`Scraping page ${page} of ${reviewType} queue`);

            const html = await this._browser.scrapeHtml(`/review/${reviewType}/history?page=${page}`);
            const rows = html('.history-table tr').toArray();

            for (let row of rows) {
                row = html(row);
                const userA = row.find('td').eq(0).find('a');
                const userId = userA.attr('href').split('/')[2];
                const userName = userA.text();

                const postHref = row.find('td').eq(1).find('a').attr('href');
                const split = postHref.split('#');
                let postId;
                let postType;

                if (split.length > 1) {
                    postId = parseInt(split[1], 10);
                    postType = 'answer';
                } else {
                    postId = parseInt(postHref.split('/')[2], 10);
                    postType = 'question';
                }

                const reviewA = row.find('td').eq(2).find('a');
                const reviewId = reviewA.attr('href').split('/')[3];
                const reviewAction = reviewA.text().trim();

                const dateA = row.find('td').eq(3).find('span');
                const dateString = dateA.attr('title');
                const dateInt = new Date(dateString).getTime() / 1000;

                try {
                    await this._db.run(SQL`
                        INSERT OR IGNORE INTO posts (id, type) VALUES (
                            ${postId},
                            ${postType}
                        )
                    `);

                    await this._db.run(SQL`
                        INSERT INTO reviews (review_id, review_type, user_id, user_name, post_id, date, review_result) VALUES (
                            ${reviewId},
                            ${reviewType},
                            ${userId},
                            ${userName},
                            ${postId},
                            ${dateInt},
                            ${reviewAction}
                        )
                    `);
                } catch (err) {
                    if (err.code !== 'SQLITE_CONSTRAINT') {
                        throw err;
                    }
                }

                // We've fetched up to our last review
                if (reviewId == latestReview.review_id && userId == latestReview.user_id) {
                    return reviewCount; // We're done here. Got all the reviews we need
                }

                reviewCount++;
            }

            await delay(2000);
        }
    }

    async scrape() {
        while (true) {
            console.log('Starting Review Scrape');
            const countLA = await this._scrapeReviews('late-answers');
            const countFP = await this._scrapeReviews('first-posts');
            const countLQP = await this._scrapeReviews('low-quality-posts');
            console.log(`Scrape finished! Got ${countLA} new late-answers, ${countFP} new first-posts, and ${countLQP} new low-quality-posts.`);
            await delay(30 * 60 * 1000);
        }
    }
}