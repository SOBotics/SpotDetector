import SQL from "sql-template-strings";
import * as sqlite from "sqlite";
import sqlite3 from "sqlite3";
import type { PostType, ReviewType } from "./fetchers/index.js";
import type { Review } from "./parsers/reviews.js";

export type PostFromDB = {
    id: number,
    type: PostType,
    user_id: number,
    deleted: null,
    delete_reason: null;
};

export type ReviewFromDB = {
    review_id: number,
    review_type: ReviewType,
    user_id: number,
    user_name: string,
    post_id: number,
    date: number,
    review_result: string;
}

/**
 * @summary opens an SQLite database connection
 * @param filename path to database file or ':memory:'
 */
export const openDatabase = async (filename: string): Promise<
    sqlite.Database<sqlite3.Database, sqlite3.Statement>
> => {
    return sqlite.open({
        driver: sqlite3.verbose().Database,
        filename
    });
};

/**
 * @summary creates table for storing posts
 * @param db database instance
 */
export const createPostsTable = async (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
): Promise<void> => {
    return db.exec(`
        CREATE TABLE IF NOT EXISTS posts (
            id             INTEGER NOT NULL,
            user_id        INTEGER NOT NULL,
            type           TEXT    NOT NULL,
            deleted        INTEGER,
            delete_reason  TEXT,
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
 * @summary creates an index on a given table
 * @param db database instance
 * @param table table name to create index on
 * @param name index name
 * @param columns columns to index on and order
 * @param filter index filter
 */
export const createIndex = async (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    table: string,
    name: string,
    columns: Record<string, "asc" | "desc">,
    filter?: string
): Promise<void> => {
    return db.exec(`
        CREATE INDEX IF NOT EXISTS ${name} ON ${table} (
            ${Object.entries(columns).map(([cname, order]) => `${cname} ${order.toUpperCase()}`, "").join(",\n")}
        )${filter ? ` WHERE ${filter}` : ""};
    `);
};

/**
 * @summary initializes the database
 */
export const initialize = async (): Promise<sqlite.Database<sqlite3.Database, sqlite3.Statement>> => {
    const db = await openDatabase("./posts.db");

    await createPostsTable(db);
    await createReviewsTable(db);

    await createIndex(db, "reviews", "idx_post_id", { post_id: "asc" });
    await createIndex(db, "reviews", "idx_post_deleted_review_result", {
        post_deleted: "asc",
        review_result: "asc"
    });

    await createIndex(db, "posts", "idx_post_deleted", { deleted: "asc" }, "deleted IS NULL");
    await createIndex(db, "posts", "idx_user_id", { user_id: "asc" });

    return db;
};

/**
 * @summary adds a post into the database
 * @param db database instance
 * @param id id of the post
 * @param type type of the post
 * @param uid author user id
 */
export const addPost = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    id: number,
    type: PostType,
    uid?: number
) => {
    const columns = `id, type${uid ? ", user_id" : ""}`;
    const values = `${id}, '${type}'${uid ? `, ${uid}` : ""}`;

    return db.run(`INSERT OR IGNORE INTO posts (${columns}) VALUES (${values})`);
};

/**
 * @summary adds a review into the database
 * @param db database instance
 * @param init review information
 */
export const addReview = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>,
    init: Omit<Review, "date" | "post_type"> & { date: number; }
) => {
    const { user_id, user_name, type, post_id, review_id, date, action } = init;

    return db.run(SQL`
        INSERT INTO reviews (review_id, review_type, user_id, user_name, post_id, date, review_result) VALUES (
            ${review_id},
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
        user_id?: number
    }
) => {
    const { deleted = false, deleteReason = null, user_id = null } = init;

    return db.run(SQL`
        UPDATE posts
        SET deleted = ${deleted ? 1 : 0}, delete_reason = ${deleteReason}, user_id = ifnull(${user_id}, user_id)
        WHERE id = ${id}
    `);
};

/**
 * @summary gets post records from the database
 * @param db database instance
 */
export const getPosts = (
    db: sqlite.Database<sqlite3.Database, sqlite3.Statement>
): Promise<Array<PostFromDB & Pick<ReviewFromDB, "date">>> => {
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
): Promise<ReviewFromDB | undefined> => {
    return db.get(SQL`
            SELECT review_id, user_id
            FROM reviews
            WHERE review_type = ${reviewType}
            ORDER BY date DESC
            LIMIT 1
        `);
};

export default initialize;
