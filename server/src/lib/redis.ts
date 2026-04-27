import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";
import { getDeploymentLogChannel } from "./utils.js";

const baseConfig: RedisOptions = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
};

export const REDIS_CONNECTION = new Redis({
	...baseConfig,
	maxRetriesPerRequest: null, // required for BullMQ workers
});
export const REDIS_PUBLISHER = new Redis(baseConfig);
export const REDIS_SUBSCRIBER = new Redis(baseConfig);

export type DeploymentLogListener = (record: unknown) => void;

const listenersByChannel = new Map<string, Set<DeploymentLogListener>>();

REDIS_SUBSCRIBER.on("message", (channel, message) => {
	const listeners = listenersByChannel.get(channel);
	if (!listeners?.size) return;

	let record: unknown;
	try {
		record = JSON.parse(message);
	} catch {
		record = message;
	}

	for (const listener of listeners) listener(record);
});

export const subscribeToDeploymentLogs = async (
	deploymentId: string,
	listener: DeploymentLogListener,
): Promise<() => Promise<void>> => {
	const channel = getDeploymentLogChannel(deploymentId);
	let listeners = listenersByChannel.get(channel);

	if (!listeners) {
		listeners = new Set();
		listenersByChannel.set(channel, listeners);
		await REDIS_SUBSCRIBER.subscribe(channel);
	}

	listeners.add(listener);

	return async () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			listenersByChannel.delete(channel);
			await REDIS_SUBSCRIBER.unsubscribe(channel);
		}
	};
};
