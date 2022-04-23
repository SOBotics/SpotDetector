import Client, { ChatEventType } from "chatexchange";
import WebsocketEvent from "chatexchange/dist/WebsocketEvent";
import cron from "node-cron";
import os from "os";
import Browser from "./browser.js";
import dbInit from "./db.js";
import env, { BotEnvironment, validateEnv } from "./env.js";
import PostFetcher from "./fetchers/posts.js";
import ReviewFetcher from "./fetchers/reviews.js";
import generate from "./reports/index.js";
import { delay, mdURL, safeMatch } from "./utils.js";

const main = async () => {
    const valid = validateEnv(env);
    if (!valid) {
        return;
    }

    // FIXME: why is user-defined guard not narrowing?
    const { TENK_EMAIL, TENK_PASSWORD, CHAT_EMAIL, CHAT_PASSWORD, CHAT_ROOM, REPORT_USER } = env as Required<BotEnvironment>;

    const db = await dbInit();
    const browser = new Browser();
    await browser.login(TENK_EMAIL, TENK_PASSWORD);

    await delay(1000);

    const ce = new Client("stackoverflow.com");
    await ce.login(CHAT_EMAIL, CHAT_PASSWORD);

    const room = ce.getRoom(+CHAT_ROOM);
    await room.join();

    room.only(ChatEventType.USER_MENTIONED);

    room.on("message", async (msg: WebsocketEvent) => {
        const { id: botId } = await ce.getMe();

        const { targetUserId } = msg;

        if (targetUserId !== botId) return;

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
                    const [newDays] = safeMatch(/^(\d+)d$/i, param);

                    if (+newDays > 0) {
                        days = +newDays;
                    }

                    const [newReviewThreshold] = safeMatch(/^(\d+)$/i, param);

                    if (+newReviewThreshold > 0) {
                        reviewThreshold = +newReviewThreshold;
                    }
                }

                const report = await generate(db, days, reviewThreshold);

                if (report) {
                    await room.sendMessage(
                        `Opened [${days} day report](${report.url}). ${report.users
                        } user${report.users === 1 ? "" : "s"
                        } found matching ${reviewThreshold} or more possible bad reviews.`
                    );
                } else {
                    await room.sendMessage(
                        `No users matching ${reviewThreshold} or more possible bad reviews, within the last ${days} day${days === 1 ? "" : "s"
                        }.`
                    );
                }

                break;
        }
    });

    await room.watch();

    // TODO: make configurable
    const stackapps = mdURL("https://stackapps.com/questions/8091", "SpotDetector");
    const reportDays = env.REPORT_DAYS;
    const reportReviews = env.REPORT_REVIEWS;
    const reportUsername = await ce.getUser(REPORT_USER).name;  // TODO: multiple users, use User class

    await room.sendMessage(
        `[ ${stackapps} ] Started on ${os.hostname()}`
    );

    cron.schedule(
        "0 3 * * 5",
        async () => {
            const report = await generate(db, reportDays, reportReviews);
            if (!report) return;

            const { users, url } = report;

            await room.sendMessage(
                `[ ${stackapps} ] @${reportUsername} Your [${reportDays}-day report](${url}) has arrived. ${users} user${users === 1 ? "" : "s"
                } found matching ${reportReviews} or more possible bad reviews.`
            );
        },
        {
            timezone: "Etc/UTC"
        }
    );

    // Fetch timeline, post to bot
    const rf = new ReviewFetcher(browser, db);
    const pf = new PostFetcher(browser, db);

    await rf.scrape();
    await pf.scrape();

    process.on("SIGTERM", async () => {
        await room.sendMessage(`[ ${stackapps} ] Shutting down on ${os.hostname()}`);
        process.exit(0);
    });
};

main();
