import { expect } from "chai";
import { PostType } from "../../src/fetchers/index.js";
import { getPostMetadataFromLink } from "../../src/utils.js";

describe('Utilities', () => {
    describe(getPostMetadataFromLink.name, () => {
        it('should correctly get answer metadata from links', () => {
            const [id, type] = getPostMetadataFromLink("https://meta.stackoverflow.com/questions/417586/417587#417587");
            expect(id).to.equal(417587);
            expect(type).to.equal(PostType.A);
        });

        it('should correctly get question metadata from links', () => {
            const [id, type] = getPostMetadataFromLink("https://meta.stackoverflow.com/questions/417586/test");
            expect(id).to.equal(417586);
            expect(type).to.equal(PostType.Q);
        });
    });
});