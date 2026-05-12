import pino, { type Logger } from "pino";
import { pinoHttp } from "pino-http";
import pretty from "pino-pretty";
import { env } from "../config/env.js";
import { REDIS_PUBLISHER } from "./redis.js";
import { getDeploymentLogStreamKey } from "./utils.js";
import { AsyncLocalStorage } from "node:async_hooks";

type LoggerContext = {
	logger: Logger;
};

const loggerContext = new AsyncLocalStorage<LoggerContext>();

const redisStream = {
	write(message: string) {
		const slug = loggerContext.getStore()?.logger.bindings().slug;
		if (typeof slug !== "string" || slug.length === 0) {
			return;
		}

		REDIS_PUBLISHER.xadd(
			getDeploymentLogStreamKey(slug),
			"MAXLEN",
			"~",
			"5000",
			"*",
			"data",
			message,
		).catch(() => {});
	},
};

const logger = pino(
	{ level: env.LOG_LEVEL },
	pino.multistream([
		{ level: env.LOG_LEVEL, stream: pretty({ colorize: true }) },
		{ level: env.LOG_LEVEL, stream: redisStream },
	]),
);

export const httpLogger = pinoHttp({ logger });

export function getLogger(): Logger {
	return loggerContext.getStore()?.logger ?? logger;
}

export function runWithLoggerContext<T>(childLogger: Logger, fn: () => T): T {
	return loggerContext.run({ logger: childLogger }, fn);
}

export function runWithSlug<T>(
	slug: string | undefined,
	fn: (logger: Logger) => T,
): T {
	const base = getLogger();
	if (!slug) return fn(base);
	const child = base.child({ slug });
	return runWithLoggerContext(child, () => fn(child));
}
