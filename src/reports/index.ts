import request from "request-promise-native";
import type { Database } from "sqlite";

/**
 * @summary generates a report
 * @param db SQLite database instance
 * @param days number of days to include
 * @param reviews number of reviews to include
 */
export const generate = async (db: Database, days: number, reviews: number) => {
    const rows = await db.all(`
        SELECT count(r.review_id) as reviews, SUM(r.review_type IN('first-posts', 'late-answers')) AS fpla_count, r.user_id, r.user_name
        FROM reviews r
        LEFT JOIN posts p ON p.id = r.post_id
        LEFT JOIN (
            SELECT review_id, SUM(review_result = 'Looks OK') AS ok, SUM(review_result = 'Recommend Deletion' OR review_result = 'Delete') AS "delete"
            FROM reviews
            WHERE review_type = 'low-quality-posts'
            GROUP BY review_id
        ) lqc ON lqc.review_id = r.review_id
        WHERE p.deleted = 1
        AND datetime(r.date, 'unixepoch') > datetime('now','-${days} days')
        AND p.delete_reason NOT IN ('self', 'self_nuked', 'duplicate')
        AND (
            (
                r.review_result = 'Looks OK'
                AND r.review_type = 'low-quality-posts'
                AND (lqc.ok = 1 OR p.delete_reason = 'diamond_mod')
            )
            OR
            (
                r.review_result = 'No Action Needed'
                AND r.review_type IN ('first-posts', 'late-answers')
            )
        )
        GROUP BY r.user_id
        HAVING reviews >= ${reviews} AND fpla_count > 0
        ORDER BY reviews DESC
    `);

    if (!rows.length) {
        return;
    }

    const allReviews = await Promise.all(
        rows.map(async row => {
            const reviews = await db.all(`
            SELECT r.review_id, r.review_type, p.delete_reason
            FROM reviews r
            LEFT JOIN posts p ON p.id = r.post_id
            LEFT JOIN (
                SELECT review_id, SUM(review_result = 'Looks OK') AS ok, SUM(review_result = 'Recommend Deletion' OR review_result = 'Delete') AS "delete"
                FROM reviews
                WHERE review_type = 'low-quality-posts'
                GROUP BY review_id
            ) lqc ON lqc.review_id = r.review_id
            WHERE p.deleted = 1
            AND datetime(date, 'unixepoch') > datetime('now', '-${days} days')
            AND p.delete_reason NOT IN ('self', 'self_nuked')
            AND (
                (
                    r.review_result = 'Looks OK'
                    AND r.review_type = 'low-quality-posts'
                    AND (lqc.ok = 1 OR p.delete_reason = 'diamond_mod')
                )
                OR
                (
                    r.review_result = 'No Action Needed'
                    AND r.review_type IN ('first-posts', 'late-answers')
                )
            )
            AND user_id = ${row.user_id}
            ORDER BY date DESC
        `);

            return [
                {
                    id: "user",
                    name: row.user_name,
                    value: `https://stackoverflow.com/users/${row.user_id}`,
                    type: "link"
                },
                {
                    id: "deletedReviews",
                    name: "Deleted Reviews",
                    value: row.reviews
                },
                {
                    id: "reviews",
                    name: "Reviews",
                    type: "fields",
                    fields: reviews.map((review, idx) => {
                        return {
                            id: `report${idx}`,
                            name: `${review.review_type} (${review.delete_reason})`,
                            value: `https://stackoverflow.com/review/${review.review_type}/${review.review_id
                                }`,
                            type: "link"
                        };
                    })
                }
            ];
        })
    );

    const res = await request({
        uri: "https://reports.sobotics.org/api/v2/report/create",
        //uri: 'http://reports-backup.bot.nu/api/v2/report/create',
        method: "post",
        json: {
            // TODO: make configurable
            appName: "SpotDetector",
            appURL: "https://stackapps.com/questions/8091",
            fields: allReviews
        }
    });

    return {
        url: res.reportURL,
        users: rows.length
    };
};

export default generate;