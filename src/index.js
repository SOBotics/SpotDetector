import dbInit from "./db";
import Browser from "./Browser";
import ReviewFetcher from "./ReviewFetcher";
import PostFetcher from "./PostFetcher";
import Client from "chatexchange";
import { delay } from "./utils";
import env from "./env";
import Message from "chatexchange/dist/Message";
import request from "request-promise-native";
import { SQL } from "sql-template-strings";
import cron from "node-cron";
import os from "os";

const generateReport = async (db, days, reviews) => {
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
    return false;
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
              value: `https://stackoverflow.com/review/${review.review_type}/${
                review.review_id
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

const main = async () => {
  const db = await dbInit();
  const browser = new Browser();
  await browser.login(env.TENK_EMAIL, env.TENK_PASSWORD);

  await delay(1000);

  const ce = new Client("stackoverflow.com");
  await ce.login(env.CHAT_EMAIL, env.CHAT_PASSWORD);
  const me = await ce.getMe();

  let room = await ce.joinRoom(env.CHAT_ROOM);

  room.on("close", async () => {
    console.log("Connection closed");

    room = await ce.joinRoom(env.CHAT_ROOM);
  });

  room.on("message", async msg => {
    if (msg._eventType == 8 && (await msg.targetUserId) == me.id) {
      // Horray!
      const content = (await msg.content)
        .split(/ +/)
        .filter(split => !split.startsWith("@"));

      const command = content[0].toLowerCase().trim();

      const rest = content.slice(1);

      switch (command) {
        case "alive":
          await msg.reply("Yep o/");
          break;
        case "instance":
          await msg.reply(`Running ${os.hostname()}`);
          break;
        case "report":
          let days = 30;
          let reviewThreshold = 5;

          for (const param of rest) {
            {
              const matches = /^(\d+)d$/i.exec(param);

              if (matches && matches[1] > 0) {
                days = matches[1];
              }
            }
            {
              const matches = /^(\d+)$/i.exec(param);

              if (matches && matches[1] > 0) {
                reviewThreshold = matches[1];
              }
            }
          }

          const report = await generateReport(db, days, reviewThreshold);

          if (report) {
            await room.sendMessage(
              `Opened [${days} day report](${report.url}). ${
                report.users
              } user${
                report.users === 1 ? "" : "s"
              } found matching ${reviewThreshold} or more possible bad reviews.`
            );
          } else {
            await room.sendMessage(
              `No users matching ${reviewThreshold} or more possible bad reviews, within the last ${days} day${
                days === 1 ? "" : "s"
              }.`
            );
          }

          break;
      }
    }
  });

  await room.watch();

  await room.sendMessage(
    `[ [SpotDetector](https://stackapps.com/questions/8091) ] Started on ${os.hostname()}`
  );

  cron.schedule(
    "0 3 * * 5",
    async () => {
      const report = await generateReport(db, 7, 3);
      await room.sendMessage(
        `@SamuelLiew [ [SpotDetector](https://stackapps.com/questions/8091) ] Your [7 day report](${
          report.url
        }) has arrived. ${report.users} user${
          report.users === 1 ? "" : "s"
        } found matching 3 or more possible bad reviews.`
      );
    },
    {
      timezone: "Etc/UTC"
    }
  );

  // Fetch timeline, post to bot
  const rf = new ReviewFetcher(db, browser);
  rf.scrape();

  const pf = new PostFetcher(db, browser);
  pf.scrape();

  process.on("SIGTERM", async () => {
    await room.sendMessage(
      `[ [SpotDetector](https://stackapps.com/questions/8091) ] Shutting down on ${os.hostname()}`
    );
    process.exit(0);
  });
};

main();
