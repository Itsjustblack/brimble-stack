import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().positive().default(3000),
	DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required."),
	REDIS_HOST: z.string().trim().min(1).default("localhost"),
	REDIS_PORT: z.coerce.number().int().positive().default(6379),
	REPO_DIR: z.string().trim().min(1).default("./tmp"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),
	ENCRYPTION_KEY: z
		.string()
		.regex(
			/^[0-9a-f]{64}$/i,
			"ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32",
		),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Invalid environment variables.", parsedEnv.error.flatten());
	throw new Error("Invalid environment variables.");
}

export const env = parsedEnv.data;
