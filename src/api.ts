import type { Privilege, Wrappers } from "@userscripters/stackexchange-api-types";
import request from "request-promise-native";
import { delay } from "./utils.js";

export interface GetPrivilegesOptions {
    filter?: string;
    key: string;
    page?: number;
    site?: string;
}

const state = {
    backoff: 0
};

const API_BASE = "https://api.stackexchange.com";
const API_VER = 2.3;

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