import type { Database } from "sqlite";
import type Browser from "../browser.js";
import { addPost, addReview, getLatestReview, ReviewFromDB } from '../db.js';
import { parseReviews } from '../parsers/reviews.js';
import { delay, isErrno } from '../utils.js';
import Fetcher, { ReviewType } from './index.js';


/// <reference types="node" />

export default class ReviewFetcher extends Fetcher {

    #pages: number;

    constructor(browser: Browser, db: Database, pages = 1) {
        super(browser, db);
        this.#pages = pages;
    }

    async #scrape(reviewType: ReviewType, page = 1, count = 0): Promise<number> {
        const { browser, db } = this;

        if (page > this.#pages) return count;

        const latestReview: ReviewFromDB | undefined = await getLatestReview(db, reviewType);

        console.log(`[${reviewType}] scraping page ${page}`);

        const d = await browser.scrapeHTML(`/review/${reviewType}/history?page=${page}`);

        const history = parseReviews(d, reviewType, latestReview);

        const reviews = Object.values(history);

        for (const review of reviews) {
            const { post_id, post_type } = review;

            try {
                await addPost(db, post_id, post_type);

                await addReview(db, {
                    ...review,
                    date: new Date(review.date).getTime() / 1000,
                });
            } catch (err) {
                if (isErrno(err) && err.code !== 'SQLITE_CONSTRAINT') {
                    throw err;
                }
            }
        }

        count += reviews.length;

        await delay(2000);

        return this.#scrape(reviewType, ++page, count);
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