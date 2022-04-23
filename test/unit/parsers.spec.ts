import { expect } from "chai";
import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import { ReviewType } from "../../src/fetchers/reviews.js";
import { parseTimeline } from "../../src/parsers/timeline.js";

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

});