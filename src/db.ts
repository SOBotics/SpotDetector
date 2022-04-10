import sqlite from "sqlite";
import sqlite3 from "sqlite3";

/**
 * @summary initializes the database
 */
export const initialize = async () => {
    const db = await sqlite.open({
        driver: sqlite3.verbose().Database,
        filename: "./posts.db",
        mode: sqlite3.OPEN_CREATE
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id	INTEGER NOT NULL,
            type	TEXT NOT NULL,
            post_deleted INTEGER,
            post_delete_reason TEXT,
            PRIMARY KEY(id)
        );`);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS reviews (
            review_id	INTEGER NOT NULL,
            review_type	TEXT NOT NULL,
            user_id	INTEGER NOT NULL,
            user_name	TEXT NOT NULL,
            post_id	INTEGER NOT NULL,
            date	INTEGER NOT NULL,
            review_result	TEXT NOT NULL,
            PRIMARY KEY(review_id, user_id),
            FOREIGN KEY(post_id) REFERENCES posts(id)
        );
    `);

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

export default initialize;
