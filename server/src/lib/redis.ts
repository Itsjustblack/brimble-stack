import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

const baseConfig: RedisOptions = {
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
};

export const BULLMQ_REDIS_CONNECTION = new Redis({
	...baseConfig,
	maxRetriesPerRequest: null, // required for BullMQ workers
});
export const REDIS_PUBLISHER = new Redis(baseConfig);
export const REDIS_SUBSCRIBER = new Redis(baseConfig);

export type ChannelListener = (record: unknown) => void;

const listenersByChannel = new Map<string, Set<ChannelListener>>();

export const DEPLOYMENTS_CHANNEL = "deployments:updates";

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

export const subscribeToChannel = async (
	channel: string,
	listener: ChannelListener,
): Promise<() => Promise<void>> => {
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

export const readStream = (
	streamKey: string,
	onData: (record: unknown) => void,
): (() => Promise<void>) => {
	const redis = new Redis(baseConfig);
	let stopped = false;
	let lastId = "0-0";

	const run = async () => {
		try {
			while (!stopped) {
				let results: [string, [string, string[]][]][] | null;
				try {
					results = (await redis.xread(
						"BLOCK",
						5000,
						"STREAMS",
						streamKey,
						lastId,
					)) as [string, [string, string[]][]][] | null;
				} catch {
					break;
				}
				if (stopped || !results) continue;

				for (const [, entries] of results) {
					for (const [id, fields] of entries) {
						lastId = id;
						const dataIndex = fields.indexOf("data");
						const raw = fields[dataIndex + 1];
						if (dataIndex !== -1 && raw !== undefined) {
							let record: unknown;
							try {
								record = JSON.parse(raw);
							} catch {
								record = raw;
							}
							onData(record);
						}
					}
				}
			}
		} finally {
			try {
				await redis.quit();
			} catch {}
		}
	};

	void run();

	return async () => {
		stopped = true;
		redis.disconnect();
	};
};

export const publishDeploymentUpdate = async (
	event: unknown,
): Promise<void> => {
	await REDIS_PUBLISHER.publish(DEPLOYMENTS_CHANNEL, JSON.stringify(event));
};
