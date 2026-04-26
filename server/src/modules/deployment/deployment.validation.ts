import { z } from "zod";
import { DeploymentStatus } from "../../../generated/prisma/enums.js";

const deploymentStatusEnum = z.enum([
	DeploymentStatus.pending,
	DeploymentStatus.building,
	DeploymentStatus.deploying,
	DeploymentStatus.running,
	DeploymentStatus.failed,
]);

export const deploymentIdParamsSchema = z.object({
	id: z.uuid("Invalid deployment id."),
});

export const createDeploymentSchema = z.object({
	repoUrl: z.url("repoUrl must be a valid URL."),
	status: deploymentStatusEnum.optional(),
	imageTag: z.string().trim().min(1).optional(),
	liveUrl: z.url("liveUrl must be a valid URL.").optional(),
	containerId: z.string().trim().min(1).optional(),
	port: z
		.number()
		.int("port must be an integer.")
		.min(1, "port must be greater than 0.")
		.max(65535, "port must be less than or equal to 65535.")
		.optional(),
});

export const updateDeploymentSchema = createDeploymentSchema
	.partial()
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field is required to update a deployment.",
	});

export type CreateDeploymentBody = z.infer<typeof createDeploymentSchema>;
export type UpdateDeploymentBody = z.infer<typeof updateDeploymentSchema>;
