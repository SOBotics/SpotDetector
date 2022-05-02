import type Room from "chatexchange/dist/Room";
import type Browser from "../browser.js";
import { delay } from "../utils.js";

export interface BadSuggestedEditReviewReportConfig {
    comment: string;
    link: string;
    post_type: string;
}

/**
 * @param browser {@link Browser} instance
 * @param room {@link Room} to send the report to
 * @param config report configuration
 */
export const reportPotentiallyBadSuggestedEditsReview = async (
    browser: Browser,
    room: Room,
    config: BadSuggestedEditReviewReportConfig
) => {
    const { comment, link, post_type } = config;

    await room.sendMessage(`\n
[potentially bad review found]
votes: 2 Rejected, 1 Approved
edit summary: "${comment}"
review: ${browser.resolve(link)}
post type: ${post_type}`);

    await delay(2e3);
};