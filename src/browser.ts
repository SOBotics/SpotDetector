import { JSDOM } from "jsdom";
import type { RequestAPI, RequiredUriUrl } from "request";
import request, { RequestPromiseOptions, type RequestPromise } from 'request-promise-native';
import { delay } from './utils.js';

type Host = "https://stackoverflow.com";

export default class Browser {

    #cookies = request.jar();

    #fkey = "";

    #host: Host = "https://stackoverflow.com";

    #request: RequestAPI<RequestPromise<any>, RequestPromiseOptions, RequiredUriUrl>;

    /**
     * @summary creates an instance of {@link Browser}
     * @param host Stack Exchange network site hostname
     */
    constructor(host: Host = "https://stackoverflow.com") {
        this.#request = request.defaults({
            jar: this.#cookies,
            json: true,
        });

        this.#host = host;
    }

    /**
     * @summary logs into a {@link Host}
     * @param email account email
     * @param password account password
     */
    async login(email: string, password: string): Promise<boolean> {
        if (!email || !password) {
            return false;
        }

        const host = this.#host;

        const html = await this.#request(`${host}/users/login`);

        const fkey = this.#parseFkey(html);
        if (!fkey) {
            return false;
        }

        await this.post("/users/login", { email, password });

        return true;
    }

    /**
     * @summary gets user id of the currently logged in user
     */
    async getLoggedInUserId(): Promise<number | undefined> {
        const host = this.#host;

        const { request: { uri } } = await this.#request(`${host}/users/current`, {
            resolveWithFullResponse: true,
            followRedirect: true
        });

        const { pathname }: URL = uri;

        // https://regex101.com/r/SqNlXB/2
        const userIdUnparsed = pathname.replace(/.*?\/users\/(\d+).*$/, "$1");
        const userId = parseInt(userIdUnparsed);

        return Number.isNaN(userId) ? void 0 : userId;
    }

    /**
     * @summary scrapes an HTML document
     * @param url URL of the document
     */
    async scrapeHTML(url: string): Promise<Document> {
        const host = this.#host;

        let html: string;
        while (true) {
            try {
                html = await this.#request(`${host}${url}`);
                break;
            } catch (err) {
                console.log(`Error retreiving URL: ${host}${url}`, err);
                console.log(`Waiting 5 minutes, and trying again.`);
                await delay(5 * 60 * 1000);
            }
        }

        const fkey = this.#parseFkey(html);
        if (fkey) this.#fkey = fkey;

        const { window: { document } } = new JSDOM(html);
        return document;
    }

    /**
     * @summary extracts an fkey from HTML content
     * @param html HTML content to extract fkey from
     */
    #parseFkey(html: string): string | undefined {
        const { window: { document } } = new JSDOM(html);
        const fkeyInput = document.querySelector<HTMLInputElement>('input[name="fkey"]');
        return fkeyInput?.value;
    }

    /**
     * @summary makes a POST request with an fkey
     * @param url URL of the document
     */
    async post(url: string, data: Record<string, unknown>): Promise<unknown> {
        const res = await this.#request(`${this.#host}${url}`, {
            method: 'post',
            form: { ...data, fkey: this.#fkey }
        });

        return res;
    }
}