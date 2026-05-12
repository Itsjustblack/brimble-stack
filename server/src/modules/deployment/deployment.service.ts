import type {
	DeploymentStatus,
	Prisma,
} from "../../../generated/prisma/client.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { publishDeploymentUpdate } from "../../lib/redis.js";
import { generateDeploymentSlug } from "../../lib/utils.js";
import { buildQueue } from "../../queues/build.queue.js";
import { setEnvVars } from "../env/env.service.js";
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

	const { env, ...deploymentData } = data;
	const slug = generateDeploymentSlug(data.name);

	const newDeployment = await prisma.deployment.create({
		data: { slug, ...deploymentData } as Prisma.DeploymentCreateInput,
	});

	if (env && Object.keys(env).length > 0) {
		await setEnvVars(newDeployment.slug, env);
	}

	await buildQueue.add("build", {
		type: "build",
		slug: newDeployment.slug,
		repoUrl: newDeployment.repoUrl,
	});

	await publishDeploymentUpdate({
		type: "deployment:created",
		data: newDeployment,
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

export const getDeploymentBySlug = async (slug: string) => {
	const deployment = await prisma.deployment.findUnique({
		where: { slug },
	});

	if (!deployment) {
		throw notFound("Deployment not found.");
	}

	return deployment;
};

export const getDeploymentByRepoUrl = async (repoUrl: string) => {
	return prisma.deployment.findFirst({
		where: { repoUrl },
	});
};

export const updateDeployment = async (
	slug: string,
	data: UpdateDeploymentBody,
) => {
	const { env, ...deploymentData } = data;

	const updated = await prisma.deployment.update({
		where: { slug },
		data: deploymentData as Prisma.DeploymentUpdateInput,
	});

	if (env !== undefined) {
		await setEnvVars(slug, env);
	}

	await publishDeploymentUpdate({ type: "deployment:updated", data: updated });
	return updated;
};

export const updateDeploymentStatus = async (
	slug: string,
	status: DeploymentStatus,
) => {
	const updated = await prisma.deployment.update({
		where: { slug },
		data: { status },
	});
	await publishDeploymentUpdate({ type: "deployment:updated", data: updated });
	return updated;
};

export const stopDeployment = async (slug: string) => {
	const deployment = await getDeploymentBySlug(slug);

	if (deployment.status !== "live") {
		throw conflict(`Deployment is not running (status: ${deployment.status}).`);
	}

	const domain = new URL(deployment.liveUrl ?? "http://placeholder").hostname;

	await buildQueue.add("stop_container", {
		type: "stop_container",
		slug,
		domain,
	});

	return updateDeploymentStatus(slug, "stopped");
};

export const startDeployment = async (slug: string) => {
	const deployment = await getDeploymentBySlug(slug);

	if (!deployment.imageTag) {
		throw badRequest(
			"Deployment has no built image. Trigger a build before starting.",
		);
	}

	if (deployment.status === "live" || deployment.status === "deploying") {
		throw conflict("Deployment is already running.");
	}

	await buildQueue.add("start_container", {
		type: "start_container",
		slug: deployment.slug,
		imageTag: deployment.imageTag,
		domain: `${deployment.slug}.localhost`,
	});

	return updateDeploymentStatus(slug, "deploying");
};

export const deleteDeployment = async (slug: string) => {
	const deployment = await getDeploymentBySlug(slug);

	if (deployment.status === "live") {
		throw conflict(
			"Deployment is still running. Stop the deployment before deleting.",
		);
	}

	const deleted = await prisma.deployment.delete({
		where: { slug },
	});

	if (deployment.imageTag) {
		await buildQueue.add("delete_container_image", {
			type: "delete_container_image",
			slug: deleted.slug,
		});
	}

	await publishDeploymentUpdate({
		type: "deployment:deleted",
		data: { id: deleted.id, slug: deleted.slug },
	});
	return deleted;
};
