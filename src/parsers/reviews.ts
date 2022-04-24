import type { ReviewFromDB } from "../db.js";
import type { PostType, ReviewType } from "../fetchers/index.js";
import { getPostMetadataFromLink, getText } from "../utils.js";
import { parseEventDate, parseUserIdFromLink } from "./index.js";

export interface Review {
    action: string;
    date: string;
    post_id: number;
    post_type: PostType;
    review_id: string;
    type: ReviewType;
    user_id: string;
    user_name: string;
};

/**
 * @summary parses user review history
 * @param doc {@link Document} to process
 * @param type {@link ReviewType} to process
 * @param latestReview latest processed review
 */
export const parseReviews = (
    doc: Document,
    type: ReviewType,
    latestReview?: Review | ReviewFromDB
) => {
    const reviews: Record<string, Review> = {};

    const {
        review_id: latestReviewId,
        user_id: latestReviewUserId
    } = latestReview || {};

    const rows = doc.querySelectorAll<HTMLTableRowElement>('tr');

    for (let row of rows) {
        const { cells } = row;

        const [userCell, taskCell, actionCell, dateCell] = cells;

        const userA = userCell.querySelector("a");
        const postA = taskCell.querySelector<HTMLAnchorElement>("a:not([href*='suggested-edits'])");
        const reviewA = actionCell.querySelector("a");

        if (!userA || !postA || !reviewA) continue;

        const user_id = parseUserIdFromLink(userA);
        const user_name = getText(userCell);

        const postHref = postA.href;

        const [post_id, post_type] = getPostMetadataFromLink(postHref);

        const review_id = reviewA.href.split('/')[3];
        const action = getText(actionCell).toLowerCase();

        const date = parseEventDate(dateCell, "history-date");

        const review: Review = {
            user_name,
            user_id,
            review_id,
            post_type,
            post_id,
            type,
            date,
            action
        };

        reviews[review_id] = review;

        // We've fetched up to our last review
        if (review_id == latestReviewId && user_id == latestReviewUserId) {
            return reviews; // We're done here. Got all the reviews we need
        }
    }

    return reviews;
};