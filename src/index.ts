import Client, { ChatEventType } from "chatexchange";
import type WebsocketEvent from "chatexchange/dist/WebsocketEvent";
import os from "os";
import Browser from "./browser.js";
import dbInit from "./db.js";
import env, { BotEnvironment, validateEnv } from "./env.js";
import PostFetcher from "./fetchers/posts.js";
import ReviewFetcher from "./fetchers/reviews.js";
import generate from "./reports/index.js";
import { UserPrivilege, validateUserPrivileges } from "./user.js";
import { delay, mdURL, safeMatch } from "./utils.js";
import ReportWatcher from "./watchers/reports.js";
import SuggestedEditsWatcher from "./watchers/reviews.js";

type Command = "alive" | "instance" | "report";

const main = async () => {
    const valid = validateEnv(env);
    if (!valid) {
        return;
    }

    // FIXME: why is user-defined guard not narrowing?
    const { TENK_EMAIL, TENK_PASSWORD, CHAT_EMAIL, CHAT_PASSWORD, CHAT_ROOM, REPORT_USER, API_KEY } = env as Required<BotEnvironment>;

    const browser = new Browser();

    const loggedIn = await browser.login(TENK_EMAIL, TENK_PASSWORD);
    if (!loggedIn) {
        console.log("[fatal] failed to login to Stack Exchange");
        return;
    }

    const loggedInUserId = await browser.getLoggedInUserId();
    if (!loggedInUserId) {
        console.log("[fatal] failed to get logged in user id");
        return;
    }

    await delay(1000);

    // @ts-expect-error
    const ce: Client = new Client.default("stackoverflow.com");
    await ce.login(CHAT_EMAIL, CHAT_PASSWORD);

    const room = ce.getRoom(+CHAT_ROOM);

    const joinedRoom = await room.join();
    if (!joinedRoom) {
        console.log(`[fatal] failed to join room ${CHAT_ROOM}`);
        return;
    }

    /** TODO: make site configurable (currently not set in {@link Browser}) */
    const missingPrivileges = await validateUserPrivileges(loggedInUserId, "stackoverflow", API_KEY);

    const relevantPrivileges: UserPrivilege[] = [
        UserPrivilege.REVIEW_BASE,
        UserPrivilege.REVIEW_CLOSE,
        UserPrivilege.REVIEW_EDIT,
        UserPrivilege.REVIEW_TAGS,
        UserPrivilege.TENK_TOOLS
    ];

    const relevantMissingPrivileges = relevantPrivileges.filter(
        (privilege) => missingPrivileges.has(privilege)
    );

    if (relevantMissingPrivileges.length) {
        await room.sendMessage(
            `[warning] unprivileged report user:\n-${relevantMissingPrivileges.join("\n-")}`
        );
    }

    room.only(ChatEventType.USER_MENTIONED);

    const db = await dbInit();

    const commands = new Map<Command, (msg: WebsocketEvent, args: string[]) => Promise<unknown>>();
    commands.set("alive", (msg) => msg.reply("wuf!"));
    commands.set("instance", (msg) => msg.reply(`Running ${os.hostname()}`));
    commands.set("report", async (_, args) => {
        let days = 30;
        let reviewThreshold = 5;

        for (const param of args) {
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
    });

    room.on("message", async (msg: WebsocketEvent) => {
        const { id: botId } = await ce.getMe();

        const { targetUserId } = msg;

        if (targetUserId !== botId) return;

        // Horray!
        const content = (await msg.content)
            .split(/ +/)
            .filter(split => !split.startsWith("@"));

        const command = content[0].toLowerCase().trim() as Command;

        const rest = content.slice(1);

        commands.get(command)?.(msg, rest);
    });

    await room.watch();

    const { REPORT_DAYS, REPORT_REVIEWS, STACKAPPS_POST } = env;

    const me = await ce.getMe();
    const botUsername = await me.name;

    const stackapps = mdURL(`https://stackapps.com/questions/${STACKAPPS_POST}`, botUsername);
    const reportUsername = await ce.getUser(REPORT_USER).name;  // TODO: multiple users, use User class

    await room.sendMessage(
        `[ ${stackapps} ] Started on ${os.hostname()}`
    );

    if (!missingPrivileges.has(UserPrivilege.REVIEW_EDIT)) {
        const seWatcher = new SuggestedEditsWatcher(browser, db, room, {
            key: API_KEY,
            hours: 48
        });

        await seWatcher.watch("0 */6 * * *", true);
    }

    if (!missingPrivileges.has(UserPrivilege.TENK_TOOLS)) {
        const { REVIEW_PAGES } = env;

        const reportWatcher = new ReportWatcher(browser, db, room, {
            days: REPORT_DAYS,
            username: reportUsername,
            reviews: REPORT_REVIEWS,
            stackapps
        });

        // Fetch timeline, post to bot
        const rf = new ReviewFetcher(browser, db, REVIEW_PAGES);
        const pf = new PostFetcher(browser, db);

        await rf.scrapeAll();
        await pf.scrapeAll();

        await reportWatcher.watch("0 3 * * 5");
    }

    process.on("SIGTERM", async () => {
        await room.sendMessage(`[ ${stackapps} ] Shutting down on ${os.hostname()}`);
        process.exit(0);
    });
};

main();
