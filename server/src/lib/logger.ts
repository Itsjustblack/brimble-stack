import pino from "pino";
import { pinoHttp } from "pino-http";
import pretty from "pino-pretty";
import { env } from "../config/env.js";
import { REDIS_PUBLISHER } from "./redis.js";
import { getDeploymentLogChannel } from "./utils.js";

const redisStream = {
	write(line: string) {
		let record: { deploymentId?: unknown };
		try {
			record = JSON.parse(line);
		} catch {
			return;
		}

		const deploymentId = record.deploymentId;
		if (typeof deploymentId !== "string" || deploymentId.length === 0) {
			return;
		}

		REDIS_PUBLISHER.publish(getDeploymentLogChannel(deploymentId), line).catch(
			() => {},
		);
	},
};

export const logger = pino(
	{ level: env.LOG_LEVEL },
	pino.multistream([
		{ level: env.LOG_LEVEL, stream: pretty({ colorize: true }) },
		{ level: env.LOG_LEVEL, stream: redisStream },
	]),
);

export const httpLogger = pinoHttp({ logger });
