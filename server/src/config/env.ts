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
	BUILDKIT_HOST: z
		.string()
		.trim()
		.min(1, "BUILDKIT_HOST is required.")
		.default("tcp://buildkitd:1234"),
	IMAGE_STORE_DIR: z.string().trim().min(1).default("./tmp/images"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Invalid environment variables.", parsedEnv.error.flatten());
	throw new Error("Invalid environment variables.");
}

export const env = parsedEnv.data;
