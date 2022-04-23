import { expect } from "chai";
import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import { ReviewType } from "../../src/fetchers/reviews.js";
import { parseTimeline } from "../../src/parsers/timeline.js";

describe("Timeline Parsers", () => {

    const postMock = readFileSync("test/mocks/timeline.html", { encoding: "utf-8" });
    const { window: { document } } = new JSDOM(postMock);

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