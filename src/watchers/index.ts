import type Room from "chatexchange/dist/Room";
import type { Database } from "sqlite";

export default abstract class Watcher {
    constructor(protected db: Database, protected room: Room) { }

    abstract watch(cronExpression: string): Promise<void>;
}