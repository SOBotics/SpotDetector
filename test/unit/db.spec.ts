import { expect } from "chai";
import { createPostsTable, createReviewsTable, openDatabase } from "../../src/db.js";

describe('Database', () => {
    describe(createPostsTable.name, () => {
        it('should correctly create posts table', async () => {
            const db = await openDatabase(":memory:");

            await createPostsTable(db);

            const columns = await db.all("pragma table_info('posts')");

            const [id, type, deleted, reason] = columns;

            expect(id.type).to.equal("INTEGER");
            expect(id.notnull).to.equal(1);
            expect(id.pk).to.equal(1);

            expect(type.type).to.equal("TEXT");
            expect(type.notnull).to.equal(1);

            expect(deleted.type).to.equal("INTEGER");
            expect(reason.type).to.equal("TEXT");
        });
    });

    describe(createReviewsTable.name, () => {
        it('should correctly create reviews table', async () => {
            const db = await openDatabase(":memory:");

            await createReviewsTable(db);

            const columns = await db.all("pragma table_info('reviews')");

            const [id, type, uid, uname, pid, date, result] = columns;

            expect(id.type).to.equal("INTEGER");
            expect(id.notnull).to.equal(1);
            expect(id.pk).to.equal(1);

            expect(type.type).to.equal("TEXT");
            expect(type.notnull).to.equal(1);

            expect(uid.type).to.equal("INTEGER");
            expect(uid.notnull).to.equal(1);
            expect(uid.pk).to.equal(2);

            expect(uname.type).to.equal("TEXT");
            expect(uname.notnull).to.equal(1);

            expect(pid.type).to.equal("INTEGER");
            expect(pid.notnull).to.equal(1);

            expect(date.type).to.equal("INTEGER");
            expect(date.notnull).to.equal(1);

            expect(result.type).to.equal("TEXT");
            expect(result.notnull).to.equal(1);
        });
    });
});