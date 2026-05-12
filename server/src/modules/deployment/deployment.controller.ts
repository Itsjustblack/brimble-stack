import type { Request, Response } from "express";
import { getLogger } from "../../lib/logger.js";
import { DEPLOYMENTS_CHANNEL } from "../../lib/redis.js";
import { openSseStream } from "../../lib/sse.js";
import {
	getDeploymentLogStreamKey,
	removeUndefinedFields,
} from "../../lib/utils.js";
import {
	createDeployment,
	deleteDeployment,
	getDeploymentBySlug,
	getDeployments,
	startDeployment,
	stopDeployment,
	updateDeployment,
	type CreateDeploymentInput,
	type UpdateDeploymentInput,
} from "./deployment.service.js";
import {
	deploymentSchema,
	deploymentSlugParamsSchema,
	updateDeploymentSchema,
} from "./deployment.validation.js";

export const createDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const data = removeUndefinedFields(
		deploymentSchema.parse(request.body),
	) as CreateDeploymentInput;

	getLogger().info({ data }, "Creating deployment");

	const deployment = await createDeployment(data);

	return response.status(201).json({
		message: "Deployment created successfully.",
		data: deployment,
	});
};

export const getDeploymentBySlugHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	const deployment = await getDeploymentBySlug(slug);

	return response.status(200).json({
		data: deployment,
	});
};

export const updateDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	const data = removeUndefinedFields(
		updateDeploymentSchema.parse(request.body),
	) as UpdateDeploymentInput;
	const deployment = await updateDeployment(slug, data);

	return response.status(200).json({
		message: "Deployment updated successfully.",
		data: deployment,
	});
};

export const streamDeploymentsHandler = async (
	request: Request,
	response: Response,
) => {
	const deployments = await getDeployments();

	await openSseStream(request, response, {
		channel: DEPLOYMENTS_CHANNEL,
		initialEvent: { type: "connected", deployments },
	});
};

export const streamDeploymentLogsHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	await getDeploymentBySlug(slug);

	await openSseStream(request, response, {
		streamKey: getDeploymentLogStreamKey(slug),
		initialEvent: { type: "connected", slug },
	});
};

export const stopDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	const deployment = await stopDeployment(slug);

	return response.status(200).json({
		message: "Deployment stopped successfully.",
		data: deployment,
	});
};

export const startDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	const deployment = await startDeployment(slug);

	return response.status(200).json({
		message: "Deployment start triggered successfully.",
		data: deployment,
	});
};

export const deleteDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	await deleteDeployment(slug);

	return response.status(200).json({
		message: "Deployment deleted successfully.",
	});
};
