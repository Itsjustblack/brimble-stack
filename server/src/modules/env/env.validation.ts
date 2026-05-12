import { z } from "zod";

const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_KEYS = 100;
const MAX_VALUE_BYTES = 32 * 1024;

export const envKeySchema = z
	.string()
	.trim()
	.min(1, "env key is required.")
	.max(256, "env key is too long.")
	.regex(ENV_KEY_REGEX, "env key must match /^[A-Za-z_][A-Za-z0-9_]*$/.");

export const envValueSchema = z
	.string()
	.max(MAX_VALUE_BYTES, "env value exceeds 32KB limit.");

export const envMapSchema = z
	.record(envKeySchema, envValueSchema)
	.refine(
		(map) => Object.keys(map).length <= MAX_KEYS,
		`At most ${MAX_KEYS} env vars are allowed.`,
	);

export const deploymentSlugParamsSchema = z.object({
	slug: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "Invalid deployment slug."),
});

export const envKeyParamsSchema = deploymentSlugParamsSchema.extend({
	key: envKeySchema,
});

export const setEnvBodySchema = z.object({
	env: envMapSchema,
});

export const upsertEnvBodySchema = z.object({
	value: envValueSchema,
});

export type EnvMap = z.infer<typeof envMapSchema>;
