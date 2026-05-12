import type { Deployment } from "@/components/deployment-list";
import { apiClient } from "../api-client";

export const getDeployments = async (): Promise<Deployment[]> => {
	const response = await apiClient.get("/deployments");
	return response.data.data;
};
