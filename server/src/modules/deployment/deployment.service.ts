import type {
	Prisma,
	DeploymentStatus,
} from "../../../generated/prisma/client.js";
import { conflict } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { buildQueue } from "../../queues/build.queue.js";
import type {
	CreateDeploymentBody,
	UpdateDeploymentBody,
} from "./deployment.validation.js";

export type {
	CreateDeploymentBody as CreateDeploymentInput,
	UpdateDeploymentBody as UpdateDeploymentInput,
} from "./deployment.validation.js";

export const createDeployment = async (data: CreateDeploymentBody) => {
	const deployment = await getDeploymentByRepoUrl(data.repoUrl);

	if (deployment) {
		throw conflict("Deployment with this repo URL already exists");
	}

	const newDeployment = await prisma.deployment.create({
		data: data as Prisma.DeploymentCreateInput,
	});

	await buildQueue.add("deployment-build", {
		deploymentId: newDeployment.id,
		repoUrl: newDeployment.repoUrl,
	});

	return newDeployment;
};

export const getDeployments = async () => {
	return prisma.deployment.findMany({
		orderBy: {
			createdAt: "desc",
		},
	});
};

export const getDeploymentById = async (id: string) => {
	return prisma.deployment.findUnique({
		where: { id },
	});
};

export const getDeploymentByRepoUrl = async (repoUrl: string) => {
	return prisma.deployment.findFirst({
		where: { repoUrl },
	});
};

export const updateDeployment = async (
	id: string,
	data: UpdateDeploymentBody,
) => {
	return prisma.deployment.update({
		where: { id },
		data: data as Prisma.DeploymentUpdateInput,
	});
};

export const updateDeploymentStatus = async (
	id: string,
	status: DeploymentStatus,
) => {
	return prisma.deployment.update({
		where: { id },
		data: { status },
	});
};

export const deleteDeployment = async (id: string) => {
	return prisma.deployment.delete({
		where: { id },
	});
};
