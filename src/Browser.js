import request from 'request-promise-native';
import cheerio from 'cheerio';
import { delay } from './utils';


export default class Browser {
    constructor() {
        this._cookieJar = request.jar();
        this._request = request.defaults({
            jar: this._cookieJar,
            json: true,
        });
        this._host = `https://stackoverflow.com`;
    }

    async login(email, password) {
        const res = await this._request(`${this._host}/users/login`);
        const $ = cheerio.load(res);

        const fkey = $('input[name="fkey"]').val();

        await this._request(`${this._host}/users/login`, {
            method: 'post',
            form: {
                fkey,
                email,
                password,
            }
        });
    }

    async scrapeHtml(url) {
        let res;
        while (true) {
            try {
                res = await this._request(`${this._host}${url}`);
                break;
            } catch (err) {
                console.log(`Error retreiving URL: ${this._host}${url}`, err);
                console.log(`Waiting 5 minutes, and trying again.`);
                await delay(5 * 60 * 1000);
            }
        }

        const $ = cheerio.load(res);

        const fkey = $('input[name="fkey"]');

        if (fkey.length > 0) {
            this._lastFKey = fkey.first().val();
        }

        return $;
    }

    async scrapeFKeyed(url, data) {
        const res = await this._request(`${this._host}${url}`, {
            method: 'post',
            form: {
                ...data,
                fkey: this._lastFKey,
            }
        });

        return res;
    }
}