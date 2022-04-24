import SQL from "sql-template-strings";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import type { PostType, ReviewType } from "./fetchers/index.js";

/**
 * @summary creates table for storing posts
 * @param db database instance
 */
export const createPostsTable = async (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
): Promise<void> => {
    return db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id                  INTEGER NOT NULL,
            type                TEXT    NOT NULL,
            post_deleted        INTEGER,
            post_delete_reason  TEXT,
            PRIMARY KEY(id)
        );`);
};

/**
 * @summary creates table for storing reviews
 * @param db database instance
 */
export const createReviewsTable = async (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
): Promise<void> => {
    return db.exec(`
        CREATE TABLE IF NOT EXISTS reviews (
            review_id       INTEGER     NOT NULL,
            review_type     TEXT        NOT NULL,
            user_id         INTEGER     NOT NULL,
            user_name       TEXT        NOT NULL,
            post_id         INTEGER     NOT NULL,
            date            INTEGER     NOT NULL,
            review_result   TEXT        NOT NULL,
            PRIMARY KEY(review_id, user_id),
            FOREIGN KEY(post_id) REFERENCES posts(id)
        );
    `);
};

/**
 * @summary initializes the database
 */
export const initialize = async (): Promise<sqlite.Database<sqlite3.Database, sqlite3.Statement>> => {
    const db = await sqlite.open({
        driver: sqlite3.verbose().Database,
        filename: "./posts.db",
        mode: sqlite3.OPEN_CREATE
    });

    await createPostsTable(db);
    await createReviewsTable(db);

    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_post_id ON reviews (
            post_id	ASC
        );
    `);

    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_post_deleted_review_result ON reviews (
            post_deleted	ASC,
            review_result	ASC
        );
    `);

    await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_post_deleted ON posts (
            deleted	ASC
        ) WHERE deleted IS NULL;
    `);

    return db;
};

/**
 * @summary adds a post into the database
 * @param db database instance
 * @param id id of the post
 * @param type type of the post
 */
export const addPost = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    id: number,
    type: PostType
) => {
    return db.run(SQL`
        INSERT OR IGNORE INTO posts (id, type) VALUES (
            ${id},
            ${type}
        )
    `);
};

/**
 * @summary adds a review into the database
 * @param db database instance
 * @param id id of the review
 * @param type type of the review
 * @param init review information
 */
export const addReview = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    id: string,
    type: ReviewType,
    init: {
        user_id: string,
        user_name: string,
        post_id: number,
        date: number,
        action: string;
    }
) => {
    const { user_id, user_name, post_id, date, action } = init;

    return db.run(SQL`
        INSERT INTO reviews (review_id, review_type, user_id, user_name, post_id, date, review_result) VALUES (
            ${id},
            ${type},
            ${user_id},
            ${user_name},
            ${post_id},
            ${date},
            ${action}
        )
    `);
};

/**
 * @summary updates a post
 * @param db database instance
 * @param id id of the post
 * @param init post information
 */
export const updatePost = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    id: number,
    init: {
        deleted?: boolean;
        deleteReason?: string;
    }
) => {
    const { deleted = false, deleteReason = null } = init;

    return db.run(SQL`
        UPDATE posts
        SET deleted = ${deleted ? 1 : 0}, delete_reason = ${deleteReason}
        WHERE id = ${id}
    `);
};

/**
 * @summary gets post records from the database
 * @param db database instance
 */
export const getPosts = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>
): Promise<{ id: number; type: PostType; date: number; }[]> => {
    return db.all(`
        SELECT p.*, r.date
        FROM posts p
        LEFT JOIN reviews r ON p.id = r.post_id
        WHERE r.review_result IN ('No Action Needed', 'Looks OK')
        AND p.deleted IS NULL
        GROUP BY p.id
        ORDER BY r.date DESC
    `);
}

/**
 * @summary gets latest review from the database by type
 * @param db database instance
 * @param reviewType type of the review
 */
export const getLatestReview = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    reviewType: ReviewType
) => {
    return db.get(SQL`
            SELECT review_id, user_id
            FROM reviews
            WHERE review_type = ${reviewType}
            ORDER BY date DESC
            LIMIT 1
        `);
};

export default initialize;
