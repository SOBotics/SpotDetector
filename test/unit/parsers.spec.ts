import { expect } from "chai";
import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import { PostType, ReviewType } from "../../src/fetchers/index.js";
import { parseReviews } from "../../src/parsers/reviews.js";
import { getLatestTimelineEvent, parseTimeline } from "../../src/parsers/timeline.js";

describe('Review Parsers', () => {

    const postMock = readFileSync("test/mocks/suggested-edits.html", { encoding: "utf-8" });
    const { window: { document } } = new JSDOM(postMock);

    describe('Suggested Edits', () => {
        const reviews = parseReviews(document, ReviewType.SE);

        it('should correctly parse reviews', () => {
            const testId = "31505074";

            const test = reviews[testId];
            expect(test).to.not.be.undefined;

            const {
                user_id,
                user_name,
                review_id,
                post_type,
                post_id,
                type,
                date,
                action
            } = test;

            expect(type).to.equal(ReviewType.SE);
            expect(action).to.equal("approve");
            expect(date).to.equal("2022-04-10 23:30:16Z");
            expect(post_id).to.equal(71821291);
            expect(post_type).to.equal(PostType.Q);
            expect(review_id).to.equal(testId);
            expect(user_id).to.equal("116908");
            expect(user_name).to.equal("Carl Norum");
        });
    });
});

describe("Timeline Parsers", () => {

    const postMock = readFileSync("test/mocks/timeline.html", { encoding: "utf-8" });
    const { window: { document } } = new JSDOM(postMock);

    describe('Deletions', () => {
        const { deletions } = parseTimeline(document);

        const events = Object.values(deletions);

        it('should correctly parse duplicate deletions', () => {
            const dupe = events.find(({ reason }) => reason === "duplicate");
            expect(dupe).to.not.be.undefined;

            if (dupe) {
                const { by } = dupe;
                expect(by.length).to.equal(1);
            }
        });

        it('should correctly parse review deletions', () => {
            const review = events.find(({ reason }) => reason === "review");
            expect(review).to.not.be.undefined;

            if (review) {
                const { by } = review;
                expect(by.length).to.equal(4);
            }
        });

        it('should correctly parse normal deletions', () => {
            const normal = events.find(({ reason }) => reason === "reputation_mod");
            expect(normal).to.not.be.undefined;

            if (normal) {
                const { by } = normal;
                expect(by.length).to.equal(3);
            }
        });

        it('should correctly parse self deletions', () => {
            const self = events.filter(({ reason }) => reason === "self");
            expect(self.length).to.equal(3);
        });
    });

    describe('Undeletions', () => {
        const { undeletions } = parseTimeline(document);

        const events = Object.values(undeletions);

        it('should correctly parse normal undeletions', () => {
            const normal = events.find(({ reason }) => reason === "reputation_mod");
            expect(normal).to.not.be.undefined;

            if (normal) {
                const { by } = normal;
                expect(by.length).to.equal(3);
            }
        });

        it('should correctly parse self undeletions', () => {
            const self = events.filter(({ reason }) => reason === "self");
            expect(self.length).to.equal(3);
        });
    });

    describe.skip("Close Votes", () => {

    });

    describe.skip("First Answers", () => {

    });

    describe.skip("First Questions", () => {

    });

    describe.skip("Late Answers", () => {

    });

    describe.skip("Low-Quality Posts", () => {

    });

    describe.skip("Reopen Votes", () => {

    });

    describe("Suggested Edits", () => {
        it('should correctly parse suggested edits review events', () => {
            const { reviews } = parseTimeline(document);

            const suggestion = Object.values(reviews).find(({ type }) => type === ReviewType.SE);

            expect(suggestion).to.not.be.undefined;

            if (suggestion) {
                const { result, votes } = suggestion;
                expect(result).to.equal("completed");
                expect(votes.approve).to.equal(1);
            }
        });
    });

    describe.skip("Triage", () => {

    });

    describe(getLatestTimelineEvent.name, () => {
        const timeline = parseTimeline(document);

        it('should correctly get the latest event by type', () => {
            const latestDeletion = getLatestTimelineEvent(timeline, "deletions");
            expect(latestDeletion?.date).to.equal("2022-04-17 03:36:45Z");

            const latestUndeletion = getLatestTimelineEvent(timeline, "undeletions");
            expect(latestUndeletion?.date).to.equal("2022-04-17 04:40:12Z");
        });
    });
});