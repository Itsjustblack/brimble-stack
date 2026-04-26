import { Queue } from "bullmq";
import { REDIS_CONNECTION } from "../lib/redis.js";

export type BuildJobData = {
	deploymentId: string;
	repoUrl: string;
};

export const buildQueue = new Queue<BuildJobData>("build-queue", {
	connection: REDIS_CONNECTION,
});
