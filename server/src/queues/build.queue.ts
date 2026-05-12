import { Queue } from "bullmq";
import { BULLMQ_REDIS_CONNECTION } from "../lib/redis.js";

export type BuildJob = {
	type: "build";
	slug: string;
	repoUrl: string;
};

export type StartContainerJob = {
	type: "start_container";
	slug: string;
	imageTag: string;
	domain: string;
	port?: number;
};

export type StopContainerJob = {
	type: "stop_container";
	slug: string;
	domain: string;
};

export type DeleteContainerImageJob = {
	type: "delete_container_image";
	slug: string;
};

export type BuildJobData = BuildJob | StartContainerJob | StopContainerJob | DeleteContainerImageJob;

export const buildQueue = new Queue<BuildJobData>("build-queue", {
	connection: BULLMQ_REDIS_CONNECTION,
});
