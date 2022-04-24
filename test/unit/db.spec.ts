import { expect } from "chai";
import { addPost, addReview, createPostsTable, createReviewsTable, openDatabase, PostFromDB, ReviewFromDB, updatePost } from "../../src/db.js";
import { PostType, ReviewType } from "../../src/fetchers/index.js";

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

    describe(addPost.name, () => {
        it('should correctly add posts', async () => {
            const db = await openDatabase(":memory:");

            await createPostsTable(db);

            await addPost(db, 42, PostType.A);
            await addPost(db, 9000, PostType.Q);

            const posts: PostFromDB[] = await db.all("SELECT * FROM posts WHERE id in (42,9000)");

            const [answer, question] = posts;

            expect(answer.id).to.equal(42);
            expect(question.id).to.equal(9000);

            expect(answer.type).to.equal(PostType.A);
            expect(question.type).to.equal(PostType.Q);
        });
    });

    describe(updatePost.name, () => {
        it('should correctly update posts', async () => {
            const db = await openDatabase(":memory:");

            await createPostsTable(db);

            await addPost(db, 42, PostType.Q);

            await updatePost(db, 42, { deleted: true, deleteReason: "because" });

            const posts: PostFromDB[] = await db.all("SELECT * FROM posts WHERE id = 42");

            const [{ delete_reason, deleted }] = posts;

            expect(deleted).to.equal(1);
            expect(delete_reason).to.equal("because");
        });
    });

    describe(addReview.name, () => {
        it('should correctly add reviews', async () => {
            const db = await openDatabase(":memory:");

            await createReviewsTable(db);

            const now = Math.trunc(Date.now() / 1000);

            await addReview(db, {
                action: "approve",
                date: now,
                review_id: "42",
                post_id: 9000,
                type: ReviewType.SE,
                user_id: "-1",
                user_name: "Community"
            });

            const reviews: ReviewFromDB[] = await db.all("SELECT * FROM reviews WHERE review_id = 42");

            const [{ user_id, user_name, post_id, review_id, review_result, review_type, date }] = reviews;

            expect(review_id).to.equal(42);
            expect(review_type).to.equal(ReviewType.SE);
            expect(post_id).to.equal(9000);
            expect(user_id).to.equal(-1);
            expect(user_name).to.equal("Community");
            expect(date).to.equal(now);
            expect(review_result).to.equal("approve");
        });
    });
});