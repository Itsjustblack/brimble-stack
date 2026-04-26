import type { Request, Response } from "express";
import { notFound } from "../../lib/errors.js";
import {
	createDeployment,
	deleteDeployment,
	getDeploymentById,
	getDeployments,
	updateDeployment,
	type CreateDeploymentInput,
	type UpdateDeploymentInput,
} from "./deployment.service.js";
import {
	createDeploymentSchema,
	deploymentIdParamsSchema,
	updateDeploymentSchema,
} from "./deployment.validation.js";
import { logger } from "../../lib/logger.js";

const removeUndefinedFields = <T extends Record<string, unknown>>(data: T) =>
	Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== undefined),
	) as T;

export const createDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const data = removeUndefinedFields(
		createDeploymentSchema.parse(request.body),
	) as CreateDeploymentInput;

	logger.info("Creating deployment with data: ", data);

	const deployment = await createDeployment(data);

	return response.status(201).json({
		message: "Deployment created successfully.",
		data: deployment,
	});
};

export const getDeploymentsHandler = async (
	_request: Request,
	response: Response,
) => {
	const deployments = await getDeployments();

	return response.status(200).json({
		data: deployments,
	});
};

export const getDeploymentByIdHandler = async (
	request: Request,
	response: Response,
) => {
	const { id } = deploymentIdParamsSchema.parse(request.params);
	const deployment = await getDeploymentById(id);

	if (!deployment) {
		throw notFound("Deployment not found.");
	}

	return response.status(200).json({
		data: deployment,
	});
};

export const updateDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { id } = deploymentIdParamsSchema.parse(request.params);
	const data = removeUndefinedFields(
		updateDeploymentSchema.parse(request.body),
	) as UpdateDeploymentInput;
	const deployment = await updateDeployment(id, data);

	return response.status(200).json({
		message: "Deployment updated successfully.",
		data: deployment,
	});
};

export const deleteDeploymentHandler = async (
	request: Request,
	response: Response,
) => {
	const { id } = deploymentIdParamsSchema.parse(request.params);
	await deleteDeployment(id);

	return response.status(200).json({
		message: "Deployment deleted successfully.",
	});
};
