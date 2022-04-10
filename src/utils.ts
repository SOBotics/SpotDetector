/**
 * @summary delays execution for a time
 * @param ms milliseconds to delay for
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));