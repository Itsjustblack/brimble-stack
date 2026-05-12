import type { Deployment } from "@/components/deployment-list";
import { useSSE } from "./use-sse";

interface DeploymentEvent {
	type: string;
	deployments?: Deployment[];
	data?: Deployment;
}

export function useDeployments() {
	const { data, connectionStatus } = useSSE<DeploymentEvent>(
		`${import.meta.env.VITE_API_URL}/deployments`,
	);

	const deployments = data.reduce<Deployment[]>((acc, event) => {
		if (event.type === "connected" && event.deployments) {
			return event.deployments;
		}
		if (event.type === "deployment:created" && event.data) {
			return [event.data, ...acc];
		}
		if (event.type === "deployment:updated" && event.data) {
			return acc.map((d) => (d.id === event.data!.id ? event.data! : d));
		}
		if (event.type === "deployment:deleted" && event.data) {
			return acc.filter((d) => d.id !== event.data!.id);
		}
		return acc;
	}, []);

	const normalizedStatus =
		connectionStatus === "OPEN"
			? "connected"
			: connectionStatus === "ERROR" || connectionStatus === "CLOSED"
				? "error"
				: "connecting";

	return { deployments, connectionStatus: normalizedStatus };
}
