const DUPLICATE_REGEX = /meta\.stackexchange\.com\/q\/104227/i;

export const parseTimeline = (doc: Document) => {
    const rows = [...doc.querySelectorAll<HTMLTableRowElement>(".event-rows tr:not(.separator)")];

    const init: {
        deleted: unknown | null,
        deletedBy: string[],
        deleteReason: string,
        reviews: Record<string, {
            eventid: string,
            link: string,
            result?: string,
            type: string;
        }>;
    } = {
        deleted: null,
        deletedBy: [],
        deleteReason: "",
        reviews: {}
    };

    return rows.reduce(
        (info, row) => {
            const { dataset } = row;

            const { eventid, eventtype } = dataset;

            const verbElem = row.querySelector<HTMLSpanElement>(".event-verb span");

            const verb = verbElem?.textContent || "";

            switch (eventtype) {
                case "history":
                    switch (verb) {
                        case "asked":
                        case "answered":
                            const userA = row.querySelector<HTMLAnchorElement>(".created-by a");

                            let userId;

                            if (userA) {
                                userId = userA.href.split("/")[2];
                            } else {
                                userId = row.querySelector(".created-by")?.textContent?.trim();
                            }

                            if (!userId) break;

                            if (
                                info.deleted &&
                                info.deletedBy.includes(userId) &&
                                info.deleteReason !== "duplicate"
                            ) {
                                info.deleteReason = userId.startsWith("user")
                                    ? "self_nuked"
                                    : "self";
                            }
                            break;
                        case "post deleted from review":
                            if (info.deleted === null) {
                                info.deleteReason = "review";
                                info.deleted = true;
                            }
                            break;
                        case "deleted":
                            if (info.deleted === null) {
                                info.deleted = true;

                                if (info.deleteReason !== "duplicate") {
                                    const flair = row.querySelector(".created-by .mod-flair");

                                    if (flair) {
                                        if (
                                            row.querySelector(".event-comment span")?.textContent?.trim() === "Converted to Comment"
                                        ) {
                                            info.deleteReason = "diamond_mod_convert";
                                        } else {
                                            info.deleteReason = "diamond_mod";
                                        }
                                    } else {
                                        info.deleteReason = "reputation_mod";
                                    }
                                }

                                const userAs = [...row.querySelectorAll<HTMLAnchorElement>(".created-by a")];

                                info.deletedBy = [
                                    ...userAs.map((el) => el.href.split("/")[2]),
                                    ...(userAs.length
                                        ? []
                                        : [row.querySelector(".created-by")?.textContent?.trim() || ""])
                                ];
                            }
                            break;
                        case "undeleted":
                            if (info.deleted === null) {
                                info.deleted = false;
                            }
                            break;
                    }
                    break;
                case "comment":
                    const commentElem = row.querySelector(".event-comment span");

                    const comment = commentElem?.innerHTML || "";

                    if (DUPLICATE_REGEX.test(comment)) {
                        info.deleteReason = "duplicate";
                    }
                case "review":
                    if (row.classList.contains("deleted-event")) {
                        const a = row.querySelector<HTMLAnchorElement>(".event-verb span a");

                        const link = a?.href || "";
                        const reviewType = a?.textContent?.trim();

                        if (eventid) {
                            switch (reviewType) {
                                case "late answer":
                                case "first post":
                                    info.reviews[eventid] = {
                                        eventid,
                                        link,
                                        type: reviewType
                                    };
                                    break;
                            }
                        }
                    } else if (
                        row.classList.contains("deleted-event-details") &&
                        eventid &&
                        typeof info.reviews[eventid] !== "undefined"
                    ) {
                        const commentElem = row.querySelector<HTMLSpanElement>(".event-comment span");

                        const comment = commentElem?.textContent?.trim() || "";

                        info.reviews[eventid].result = comment.replace(/ × 1$/, "");
                    }
                    break;
            }

            return info;
        },
        init
    );
};