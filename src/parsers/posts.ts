import type { PostTimeline } from "./timeline.js";

export interface Post {
    id: string;
    userId: string;
    timeline: PostTimeline;
}