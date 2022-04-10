const DUPLICATE_REGEX = /meta\.stackexchange\.com\/q\/104227/i;

export const parseTimeline = $ =>
    $(".event-rows tr:not(.separator)")
        .toArray()
        .reduce(
            (arr, row) => {
                const id = $(row).data("eventid");
                const eventtype = $(row).data("eventtype");
                const verb = $(row)
                    .find(".event-verb span")
                    .text()
                    .trim();

                switch (eventtype) {
                    case "history":
                        switch (verb) {
                            case "asked":
                            case "answered":
                                const userA = $(row).find(".created-by a");
                                let userId;

                                if (userA.length > 0) {
                                    userId = userA.attr("href").split("/")[2];
                                } else {
                                    userId = $(row)
                                        .find(".created-by")
                                        .text()
                                        .trim();
                                }

                                if (
                                    arr.deleted &&
                                    arr.deletedBy.includes(userId) &&
                                    arr.deleteReason !== "duplicate"
                                ) {
                                    arr.deleteReason = userId.startsWith("user")
                                        ? "self_nuked"
                                        : "self";
                                }
                                break;
                            case "post deleted from review":
                                if (arr.deleted === null) {
                                    arr.deleteReason = "review";
                                    arr.deleted = true;
                                }
                                break;
                            case "deleted":
                                if (arr.deleted === null) {
                                    arr.deleted = true;

                                    if (arr.deleteReason !== "duplicate") {
                                        if ($(row).find(".created-by .mod-flair").length > 0) {
                                            if (
                                                $(row)
                                                    .find(".event-comment span")
                                                    .text()
                                                    .trim() === "Converted to Comment"
                                            ) {
                                                arr.deleteReason = "diamond_mod_convert";
                                            } else {
                                                arr.deleteReason = "diamond_mod";
                                            }
                                        } else {
                                            arr.deleteReason = "reputation_mod";
                                        }
                                    }

                                    const userAs = $(row).find(".created-by a");

                                    arr.deletedBy = [
                                        ...userAs
                                            .map(
                                                (_, el) =>
                                                    $(el)
                                                        .attr("href")
                                                        .split("/")[2]
                                            )
                                            .toArray(),
                                        ...(userAs.length
                                            ? []
                                            : [
                                                $(row)
                                                    .find(".created-by")
                                                    .text()
                                                    .trim()
                                            ])
                                    ];
                                }
                                break;
                            case "undeleted":
                                if (arr.deleted === null) {
                                    arr.deleted = false;
                                }
                                break;
                        }
                        break;
                    case "comment":
                        const comment = $(row)
                            .find(".event-comment span")
                            .html();
                        if (DUPLICATE_REGEX.test(comment)) {
                            arr.deleteReason = "duplicate";
                        }
                    case "review":
                        if ($(row).hasClass("deleted-event")) {
                            const a = $(row).find(".event-verb span a");
                            const link = a.attr("href");
                            const reviewType = a.text().trim();

                            switch (reviewType) {
                                case "late answer":
                                case "first post":
                                    arr.reviews[id] = {
                                        id,
                                        link,
                                        type: reviewType
                                    };
                                    break;
                            }
                        } else if (
                            $(row).hasClass("deleted-event-details") &&
                            typeof arr.reviews[id] !== "undefined"
                        ) {
                            const comment = $(row)
                                .find(".event-comment span")
                                .text()
                                .trim();

                            arr.reviews[id].result = comment.replace(/ × 1$/, "");
                        }
                        break;
                }

                return arr;
            },
            {
                deleted: null,
                deletedBy: [],
                reviews: {}
            }
        );