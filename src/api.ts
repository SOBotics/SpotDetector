import type { Privilege, SuggestedEdit, User, Wrappers } from "@userscripters/stackexchange-api-types";
import request from "request-promise-native";
import { delay, getSeconds } from "./utils.js";

export interface CommonGetOptions {
    filter?: string;
    key: string;
}

export interface CommonPaginatedOptions extends CommonGetOptions {
    page?: number;
}

export interface CommonPerSiteOptions extends CommonGetOptions {
    site?: string;
}

export interface CommonIntervaledOptions extends CommonGetOptions {
    from?: string | Date | number;
    to?: string | Date | number;
}

export interface GetPrivilegesOptions extends CommonPaginatedOptions, CommonPerSiteOptions { }

export interface GetUserInfoOptions extends CommonPaginatedOptions, CommonPerSiteOptions { }

export interface GetSuggestedEditsOptions extends CommonPaginatedOptions, CommonIntervaledOptions, CommonPerSiteOptions { }

const state = {
    backoff: 0
};

const API_BASE = "https://api.stackexchange.com";
const API_VER = 2.3;

/**
 * {@see https://api.stackexchange.com/docs/privileges-on-users}
 * @param keyOn key to use for the {@link Map}
 * @param site API slug of the site to get {@link Privilege}s for
 * @param options request configuration
 */
export const getSitePrivileges = async <T extends keyof Privilege>(
    keyOn: T,
    site: string,
    options: Omit<GetPrivilegesOptions, "site">
): Promise<Map<Privilege[T], Privilege>> => {
    await delay(state.backoff);

    const { page = 1, ...rest } = options;

    const url = new URL(`${API_BASE}/${API_VER}/privileges`);
    url.search = new URLSearchParams({
        ...rest,
        page: page.toString(),
        pagesize: "100",
        site
    }).toString();

    const res: Wrappers.CommonWrapperObject<Privilege> = await request(url.toString(), {
        gzip: true,
        json: true
    });

    const { backoff, has_more, items = [] } = res;

    if (backoff) {
        state.backoff = backoff * 1e3 + 5;
        return getSitePrivileges(keyOn, site, options);
    }

    const privileges = new Map<Privilege[T], Privilege>();

    if (has_more) {
        const more = await getSitePrivileges(keyOn, site, {
            ...options,
            page: page + 1
        });

        more.forEach((v, k) => privileges.set(k, v));
    }

    items.forEach((item) => privileges.set(item[keyOn], item));
    return privileges;
};

/**
 * {@see https://api.stackexchange.com/docs/privileges-on-users}
 * @param userId user id to look up
 * @param keyOn key to use for the {@link Map}
 * @param options request configuration
 */
export const getPrivileges = async <T extends keyof Privilege>(
    userId: number,
    keyOn: T,
    options: GetPrivilegesOptions
): Promise<Map<Privilege[T], Privilege>> => {
    await delay(state.backoff);

    const { page = 1, site = "stackoverflow", ...rest } = options;

    const url = new URL(`${API_BASE}/${API_VER}/users/${userId}/privileges`);
    url.search = new URLSearchParams({
        ...rest,
        page: page.toString(),
        pagesize: "100",
        site
    }).toString();

    const res: Wrappers.CommonWrapperObject<Privilege> = await request(url.toString(), {
        gzip: true,
        json: true
    });

    const { backoff, has_more, items = [] } = res;

    if (backoff) {
        state.backoff = backoff * 1e3 + 5;
        return getPrivileges(userId, keyOn, options);
    }

    const privileges = new Map<Privilege[T], Privilege>();

    if (has_more) {
        const more = await getPrivileges(userId, keyOn, {
            ...options,
            page: page + 1
        });

        more.forEach((v, k) => privileges.set(k, v));
    }

    items.forEach((item) => privileges.set(item[keyOn], item));
    return privileges;
};

/**
 * {@see https://api.stackexchange.com/docs/users-by-ids}
 * @param userIds list of {@link User.user_id} to fetch
 * @param keyOn key to use for the {@link Map}
 * @param options request configuration
 */
export const getUserInfo = async <T extends keyof User>(
    userIds: number[],
    keyOn: T,
    options: GetUserInfoOptions
): Promise<Map<User[T], User>> => {
    await delay(state.backoff);

    const { page = 1, site = "stackoverflow", ...rest } = options;

    const url = new URL(`${API_BASE}/${API_VER}/users/${userIds}`);
    url.search = new URLSearchParams({
        ...rest,
        page: page.toString(),
        pagesize: "100",
        site
    }).toString();

    const res: Wrappers.CommonWrapperObject<User> = await request(url.toString(), {
        gzip: true,
        json: true
    });

    const { backoff, has_more, items = [] } = res;

    if (backoff) {
        state.backoff = backoff * 1e3 + 5;
        return getUserInfo(userIds, keyOn, options);
    }

    const users = new Map<User[T], User>();

    if (has_more) {
        const more = await getUserInfo(userIds, keyOn, {
            ...options,
            page: page + 1
        });

        more.forEach((v, k) => users.set(k, v));
    }

    items.forEach((item) => users.set(item[keyOn], item));
    return users;
};

/**
 * {@see https://api.stackexchange.com/docs/suggested-edits}
 * @param keyOn key to use for the {@link Map}
 * @param options request configuration
 */
export const getSuggestedEdits = async <T extends keyof SuggestedEdit>(
    type: "all" | "approved" | "rejected",
    keyOn: T,
    options: GetSuggestedEditsOptions
): Promise<Map<SuggestedEdit[T], SuggestedEdit>> => {
    await delay(state.backoff);

    const { page = 1, site = "stackoverflow", from, to, ...rest } = options;

    const params = new URLSearchParams({
        ...rest,
        page: page.toString(),
        pagesize: "100",
        site
    });

    if (type !== "all") {
        params.set("sort", type === "approved" ? "approval" : "rejection");
    }

    if (from) params.set("fromdate", getSeconds(from).toString());
    if (to) params.set("todate", getSeconds(to).toString());

    const url = new URL(`${API_BASE}/${API_VER}/suggested-edits`);
    url.search = params.toString();

    const res: Wrappers.CommonWrapperObject<SuggestedEdit> = await request(url.toString(), {
        gzip: true,
        json: true
    });

    const { backoff, has_more, items = [] } = res;

    if (backoff) {
        state.backoff = backoff * 1e3 + 5;
        return getSuggestedEdits(type, keyOn, options);
    }

    const edits = new Map<SuggestedEdit[T], SuggestedEdit>();

    if (has_more) {
        const more = await getSuggestedEdits(type, keyOn, {
            ...options,
            page: page + 1
        });

        more.forEach((v, k) => edits.set(k, v));
    }

    items.forEach((item) => edits.set(item[keyOn], item));
    return edits;
};