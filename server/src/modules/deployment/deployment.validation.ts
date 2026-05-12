import { z } from "zod";
import { DeploymentStatus } from "../../../generated/prisma/enums.js";
import { envMapSchema } from "../env/env.validation.js";

const gitRepoURLSchema = z.url().refine(
	(value) => {
		const patterns = [
			/^https?:\/\/github\.com\/[^/]+\/[^/]+(\.git)?\/?$/,
			/^https?:\/\/gitlab\.com\/[^/]+\/[^/]+(\.git)?\/?$/,
			/^https?:\/\/bitbucket\.org\/[^/]+\/[^/]+(\.git)?\/?$/,
		];

		return patterns.some((pattern) => pattern.test(value));
	},
	{
		message: "Not a valid Git repository URL",
	},
);

export const deploymentSlugParamsSchema = z.object({
	slug: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "Invalid deployment slug."),
});

export const deploymentSchema = z.object({
	name: z.string().trim().min(1, "name is required."),
	repoUrl: gitRepoURLSchema,
	status: z.enum(DeploymentStatus).optional(),
	imageTag: z.string().trim().min(1).optional(),
	liveUrl: z.url("liveUrl must be a valid URL.").optional(),
	containerId: z.string().trim().min(1).optional(),
	port: z
		.number()
		.int("port must be an integer.")
		.min(1, "port must be greater than 0.")
		.max(65535, "port must be less than or equal to 65535.")
		.optional(),
	env: envMapSchema.optional(),
});

export const createdeploymentSchema = z.object({
	name: z.string().trim().min(1, "name is required."),
	repoUrl: gitRepoURLSchema,
	env: envMapSchema.optional(),
});

export const updateDeploymentSchema = deploymentSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required to update a deployment.",
	});

export type CreateDeploymentBody = z.infer<typeof createdeploymentSchema>;
export type UpdateDeploymentBody = z.infer<typeof updateDeploymentSchema>;
