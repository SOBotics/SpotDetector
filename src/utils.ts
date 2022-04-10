/**
 * @summary delays execution for a time
 * @param ms milliseconds to delay for
 */
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @summary checks if an error is a Node.js error
 * @param err error to check
 */
export const isErrno = (err: unknown): err is NodeJS.ErrnoException => err instanceof Error && "code" in err;

/**
 * @summary makes a markdown URL
 * @param url URL to format
 * @param label label to provide
 */
export const mdURL = (url: string, label: string) => `[${label}](${url})`;

/**
 * @summary safely matches a string against a regular expression
 * @param expr regular expression to match against
 * @param text text to match
 */
export const safeMatch = (expr: RegExp, text: string) => {
    const [, ...groups] = expr.exec(text) || [];
    return groups;
};