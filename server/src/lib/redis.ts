import { Redis } from "ioredis";
import { env } from "../config/env.js";

export const REDIS_CONNECTION = new Redis({
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	maxRetriesPerRequest: null, // required for BullMQ workers
});
