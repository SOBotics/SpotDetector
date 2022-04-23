import { ReviewType } from "../fetchers/reviews.js";
import { getText, includes } from "../utils.js";

const DUPLICATE_REGEX = /meta\.stackexchange\.com\/q\/104227/i;

const REVIEW_VOTE_REGEX = /(\w[\w\s]+)\s+[\u00D7]\s+(\d+)/gm;

export type PostDeleteReason =
    | "self_nuked"
    | "self"
    | "review"
    | "reputation_mod"
    | "duplicate"
    | "diamond_mod_convert"
    | "diamond_mod";

export type PostUndeleteReason =
    | "reputation_mod"
    | "self"

export type PostReviewResult =
    | "completed"
    | "invalidated";

export type PostTimelineType =
    | "added"
    | "answered"
    | "asked"
    | "bounty ended"
    | "bounty started"
    | "deleted"
    | "edited"
    | "locked"
    | "notice added"
    | "notice removed"
    | "other"
    | "post deleted from review"
    | "protected"
    | "rollback"
    | "suggested"
    | "undeleted"
    | "unlocked";

export type DeletionEvent = {
    by: string[],
    date: string;
    reason: PostDeleteReason | "";
};

export type ReviewEvent = {
    link: string,
    result?: PostReviewResult | string,
    type: ReviewType;
    votes: Record<string, number>;
};

export type UndeletionEvent = {
    by: string[],
    date: string;
    reason: PostUndeleteReason | "";
};

export interface PostTimeline {
    deletions: Record<string, DeletionEvent>,
    reviews: Record<string, ReviewEvent>;
    undeletions: Record<string, UndeletionEvent>;
    userId: string;
}

/**
 * @summary parses event date
 * @param cell cell with event date
 */
const parseEventDate = (cell: HTMLTableCellElement): string => cell.querySelector<HTMLSpanElement>("span.relativetime")?.title || "";

/**
 * @summary parses linked user id
 * @param link link to parse
 */
const parseUserIdFromLink = (link: HTMLAnchorElement): string => link.href.split("/")[2];

/**
 * @summary parses unlinked user id (e.g. deleted users)
 * @param row table row of the event
 */
const parseUnlinkedUserId = (row: HTMLTableRowElement): string => getText(row.querySelector(".created-by"));

/**
 * @summary parses user ids from an event cell
 * @param row table row of the event
 * @param cell cell with user ids
 */
const parseUserIds = (
    row: HTMLTableRowElement,
    cell: HTMLTableCellElement
): string[] => {
    const userAs = [...cell.querySelectorAll("a")];
    const linkedUserIds = userAs.map(parseUserIdFromLink);
    const unlinkedUserIds = userAs.length ? [] : [parseUnlinkedUserId(row)];
    return [...linkedUserIds, ...unlinkedUserIds];
};

/**
 * @summary parses a {@link DeletionEvent}
 * @param row table row of the event
 * @param userCell cell with user ids
 * @param date date of the event
 * @param comment event comment
 * @param authorUserId user id of the post author
 */
const parseDeleteEvent = (
    row: HTMLTableRowElement,
    userCell: HTMLTableCellElement,
    date: string,
    comment: string,
    authorUserId?: string
): DeletionEvent => {
    const deletion: DeletionEvent = { date, by: [], reason: "reputation_mod" };

    const flair = userCell.querySelector(".mod-flair");

    if (flair) {
        deletion.reason = comment === "Converted to Comment" ? "diamond_mod_convert" : "diamond_mod";
    }

    const { nextElementSibling: commentRow } = row;
    if (commentRow) {
        const { cells } = commentRow as HTMLTableRowElement;
        const [_, typeCell, __, ___, ____, commentCell] = cells;

        const type = getText(typeCell);
        const commentLinks = [...commentCell.querySelectorAll("a")];

        const isDuplicateAnswerDeletion = commentLinks.some(({ href }) => DUPLICATE_REGEX.test(href));
        if (type === "comment" && isDuplicateAnswerDeletion) {
            deletion.reason = "duplicate";
        }
    }

    const userIds = parseUserIds(row, userCell);

    // the post has been self-deleted
    if (includes(userIds, authorUserId)) {
        deletion.reason = authorUserId.startsWith("user") ? "self_nuked" : "self";
    }

    deletion.by = userIds;
    return deletion;
};

/**
 * @summary parses a {@link DeletionEvent} (from review)
 * @param row table row of the event
 * @param userCell cell with user ids
 * @param date date of the event
 */
const parseReviewDeleteEvent = (
    row: HTMLTableRowElement,
    userCell: HTMLTableCellElement,
    date: string
): DeletionEvent => {
    const deletion: DeletionEvent = { date, by: [], reason: "review" };
    deletion.by = parseUserIds(row, userCell);
    return deletion;
};

/**
 * @summary parses a {@link ReviewEvent}
 * @param row table row of the event
 * @param verbCell cell with review type
 */
const parseReviewEvent = (
    row: HTMLTableRowElement,
    verbCell: HTMLTableCellElement
): ReviewEvent | undefined => {
    const reviewLink = verbCell.querySelector("a");
    const link = reviewLink?.href || "";

    const type = link.replace(/\/review\/(.+?)\/\d+/, "$1") as ReviewType | undefined;
    if (!type) return;

    const { nextElementSibling: commentRow } = row;
    const { cells: [_, __, resultCell, ___, ____, commentCell] } = commentRow as HTMLTableRowElement;

    const result = getText(resultCell) as PostReviewResult | "";

    const review: ReviewEvent = { link, result, type, votes: {} };

    const comment = getText(commentCell);

    const matches = [...comment.matchAll(REVIEW_VOTE_REGEX)];
    matches.forEach(([, vote, voters]) => review.votes[vote.toLowerCase()] = +voters);

    return review;
};

/**
 * @summary parses an {@link UndeletionEvent}
 * @param row table row of the event
 * @param userCell cell with user ids
 * @param date date of the event
 * @param authorUserId user id of the post author
 */
const parseUndeleteEvent = (
    row: HTMLTableRowElement,
    userCell: HTMLTableCellElement,
    date: string,
    authorUserId?: string
): UndeletionEvent => {
    const undeletion: UndeletionEvent = { by: [], date, reason: "reputation_mod" };

    const userIds = parseUserIds(row, userCell);

    // the post has been self-deleted
    if (includes(userIds, authorUserId)) {
        undeletion.reason = "self";
    }

    undeletion.by = userIds;
    return undeletion;
};

/**
 * @summary parses timeline of a given post
 * @param doc {@link Document} to process
 */
export const parseTimeline = (doc: Document): PostTimeline => {
    const init: PostTimeline = {
        deletions: {},
        reviews: {},
        undeletions: {},
        userId: ""
    };

    const wrapper = doc.querySelector(".post-timeline");
    if (!wrapper) return init;

    const rows = [...wrapper.querySelectorAll<HTMLTableRowElement>(".event-rows tr:not(.separator)")];

    let authorUserId: string | undefined;

    return rows.reduceRight(
        (info, row) => {
            const { dataset } = row;

            const { eventid, eventtype } = dataset;

            if (!eventid) return info;

            const { cells } = row;

            const [dateCell, _typeCell, verbCell, userCell, _attribCell, commentCell] = cells;

            const comment = getText(commentCell);
            const date = parseEventDate(dateCell);

            switch (eventtype) {
                case "history":
                    const verb = verbCell?.textContent?.trim() as PostTimelineType || "other";

                    switch (verb) {
                        case "asked":
                        case "answered":
                            const userLink = userCell.querySelector("a");
                            authorUserId = userLink ? parseUserIdFromLink(userLink) : userCell?.textContent?.trim();
                            init.userId = authorUserId || "";
                            break;
                        case "post deleted from review":
                            info.deletions[eventid] = parseReviewDeleteEvent(row, userCell, date);
                            break;
                        case "deleted": {
                            info.deletions[eventid] = parseDeleteEvent(row, userCell, date, comment, authorUserId);
                            break;
                        }
                        case "undeleted": {
                            info.undeletions[eventid] = parseUndeleteEvent(row, userCell, date, authorUserId);
                            break;
                        }
                    }
                    break;
                case "review": {
                    const review = parseReviewEvent(row, verbCell);
                    if (review) info.reviews[eventid] = review;
                    break;
                }
            }

            return info;
        },
        init
    );
};