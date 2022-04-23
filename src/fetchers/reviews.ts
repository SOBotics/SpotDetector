import { addPost, addReview, getLatestReview } from '../db.js';
import { delay, getPostMetadataFromLink, isErrno } from '../utils.js';
import Fetcher, { ReviewType } from './index.js';

/// <reference types="node" />

export interface Review {
    review_id: string | null;
    user_id: string | null;
}

export default class ReviewFetcher extends Fetcher {

    async #scrape(reviewType: ReviewType) {
        let page = 0;
        let reviewCount = 0;

        const latestReview: Review = await getLatestReview(this.db, reviewType) || {
            review_id: null,
            user_id: null,
        };

        while (true) {
            page++;

            // Sanity check!
            if (page > 3000) {
                break;
            }

            console.log(`Scraping page ${page} of ${reviewType} queue`);

            const d = await this.browser.scrapeHTML(`/review/${reviewType}/history?page=${page}`);
            const rows = d.querySelectorAll<HTMLTableRowElement>('.history-table tr');

            for (let row of rows) {
                const { cells } = row;

                const userA = cells[0].querySelector("a");
                const postA = cells[1].querySelector("a");
                const reviewA = cells[2].querySelector("a");
                const dateA = cells[3].querySelector("span");
                if (!userA || !postA || !reviewA || !dateA) continue;

                const userId = userA.href.split('/')[2];
                const userName = userA.textContent || "";

                const postHref = postA.href;

                const [postId, postType] = getPostMetadataFromLink(postHref);

                const reviewId = reviewA.href.split('/')[3];
                const reviewAction = reviewA.textContent?.trim() || "";

                const dateString = dateA.title;
                const dateInt = new Date(dateString).getTime() / 1000;

                try {
                    await addPost(this.db, postId, postType);

                    await addReview(this.db, reviewId, reviewType, {
                        userId,
                        userName,
                        postId,
                        dateInt,
                        reviewAction
                    });
                } catch (err) {
                    if (isErrno(err) && err.code !== 'SQLITE_CONSTRAINT') {
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

        return reviewCount;
    }

    /**
     * @summary scrapes history of a given {@link ReviewType}
     * @param type type of the review queue
     */
    async scrape(type: ReviewType): Promise<number> {
        console.log(`[${type}] starting scraping`);
        const reviews = await this.#scrape(type);
        console.log(`[${type}] finished scraping (${reviews} found)`);
        return reviews;
    }

    /**
     * @summary scrapes history of all review queues
     */
    async scrapeAll() {
        const typenames = Object.keys(ReviewType) as Array<keyof typeof ReviewType>;

        const scrapeInterval = 30 * 60 * 1000;

        while (true) {
            for (const typename of typenames) {
                await this.scrape(ReviewType[typename]);
            }

            await delay(scrapeInterval);
        }
    }
}