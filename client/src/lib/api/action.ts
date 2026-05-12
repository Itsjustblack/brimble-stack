import type { Deployment } from "@/components/deployment-list";
import { apiClient } from "../api-client";

export type CreateDeploymentPayload = {
	name: string;
	repoUrl: string;
	env?: Record<string, string>;
};

export const getDeployments = async (): Promise<Deployment[]> => {
	const response = await apiClient.get("/deployments");
	return response.data.data;
};

export const createDeployment = async (
	data: CreateDeploymentPayload,
): Promise<Deployment> => {
	const response = await apiClient.post("/deployments", data);
	return response.data.data;
};

export const deleteDeployment = async (slug: string): Promise<void> => {
	await apiClient.delete(`/deployments/${slug}`);
};

export const stopDeployment = async (slug: string): Promise<Deployment> => {
	const response = await apiClient.post(`/deployments/${slug}/stop`);
	return response.data.data;
};

export const startDeployment = async (slug: string): Promise<Deployment> => {
	const response = await apiClient.post(`/deployments/${slug}/start`);
	return response.data.data;
};
