import type { Request, Response } from "express";
import { getDeploymentBySlug } from "../deployment/deployment.service.js";
import {
	deleteEnvVar,
	listEnvVars,
	setEnvVars,
	upsertEnvVar,
} from "./env.service.js";
import {
	deploymentSlugParamsSchema,
	envKeyParamsSchema,
	setEnvBodySchema,
	upsertEnvBodySchema,
} from "./env.validation.js";

export const listEnvVarsHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	await getDeploymentBySlug(slug);

	const data = await listEnvVars(slug);
	return response.status(200).json({ data });
};

export const setEnvVarsHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug } = deploymentSlugParamsSchema.parse(request.params);
	const { env } = setEnvBodySchema.parse(request.body);

	await getDeploymentBySlug(slug);
	await setEnvVars(slug, env);

	const data = await listEnvVars(slug);
	return response.status(200).json({
		message: "Env vars replaced successfully.",
		data,
	});
};

export const upsertEnvVarHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug, key } = envKeyParamsSchema.parse(request.params);
	const { value } = upsertEnvBodySchema.parse(request.body);

	await getDeploymentBySlug(slug);
	const data = await upsertEnvVar(slug, key, value);

	return response.status(200).json({
		message: "Env var saved successfully.",
		data,
	});
};

export const deleteEnvVarHandler = async (
	request: Request,
	response: Response,
) => {
	const { slug, key } = envKeyParamsSchema.parse(request.params);

	await getDeploymentBySlug(slug);
	await deleteEnvVar(slug, key);

	return response.status(200).json({
		message: "Env var deleted successfully.",
	});
};
