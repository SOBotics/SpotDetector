import request from 'request-promise-native';

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const requestRetry = async (...args) => {
    let tries = 0;

    while (tries++ <= 5)
    {
        try {
            const res = await request(...args);
            
            return res;
        } catch (err) {
            await delay(tries * 250);
        }
    }

    throw new Error('Unable to fetch from server.');
}