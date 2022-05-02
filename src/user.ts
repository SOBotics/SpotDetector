import { getSitePrivileges, getUserInfo } from "./api.js";
import { toValueArr } from "./utils.js";

export enum UserPrivilege {
    ADS = "see reduced ads",
    BOUNTY = "set bounties",
    CHAT_CREATE = "create chat rooms",
    CHAT_GALLERY = "create gallery chat rooms",
    CHAT_TALK = "talk in chat",
    COMMENT = "comment everywhere",
    EDIT = "edit questions and answers",
    FLAG = "flag posts",
    META = "participate in meta",
    PROTECT_ANSWER = "answer protected questions",
    PROTECT_CREATE = "protect questions",
    REVIEW_BASE = "access review queues",
    REVIEW_CLOSE = "cast close & reopen votes",
    REVIEW_EDIT = "edit questions and answers",
    REVIEW_TAGS = "approve tag wiki edits",
    SCORE_BREAKDOWN = "see votes",
    TAGS_CREATE = "create new tags",
    TAGS_SYNONYMS = "create tag synonyms",
    TENK_TOOLS = "access moderator tools",
    TRUSTED_TOOLS = "access 'trusted user' tools",
    VOTE_CLOSE_READ = "view close votes",
    VOTE_CLOSE_CAST = "cast close & reopen votes",
    VOTE_DOWN_CAST = "vote down",
    VOTE_UP_CAST = "vote up",
    WIKI_CREATE = "create wiki posts",
    WIKI_EDIT = "edit community wikis"
}

/**
 * @summary validates user privileges
 * @param userId Id of the user to validate
 * @param site site of the user
 * @param key SE API key
 */
export const validateUserPrivileges = async (userId: number, site: string, key: string): Promise<Set<UserPrivilege>> => {
    // https://regex101.com/r/FdlVv1/1
    const apiSite = site.replace(/\.[^.]+?$/, "");

    const users = await getUserInfo([userId], "user_id", { key, site: apiSite });
    const privileges = await getSitePrivileges("short_description", site, { key });

    const { reputation } = users.get(userId)!;

    return new Set(
        toValueArr(privileges)
            .filter((privilege) => privilege.reputation > reputation)
            .map(({ short_description }) => short_description.toLowerCase() as UserPrivilege)
    );
};