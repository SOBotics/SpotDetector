export type DateType = "history-date" | "relativetime";

/**
 * @summary parses event date
 * @param cell cell with event date
 */
export const parseEventDate = (cell: HTMLTableCellElement, type: DateType = "relativetime"): string => cell.querySelector<HTMLSpanElement>(`span.${type}`)?.title || "";

/**
 * @summary parses linked user id
 * @param link link to parse
 */
export const parseUserIdFromLink = (link: HTMLAnchorElement): string => link.href.split("/")[2];