import { logger } from "../lib/logger.js";
import { runCommand } from "../lib/utils.js";
import { addRoute } from "./proxy.js";

type StartContainerOptions = {
	deploymentId: string;
	imageTag: string;
	domain: string;
	port?: number;
	network?: string;
	env?: Record<string, string>;
};

export async function startContainer(opts: StartContainerOptions) {
	const {
		deploymentId,
		imageTag,
		domain,
		port = 3000,
		network = "mini-paas-network",
		env = {},
	} = opts;

	const containerName = `deployment-${deploymentId}`;

	logger.info({
		deploymentId,
		imageTag,
		containerName,
		port,
		network,
	}, "Starting container");

	const args = [
		"run",
		"-d",
		"--name",
		containerName,
		"--network",
		network,
		"--restart",
		"unless-stopped",
	];

	args.push("-e", `PORT=${port}`);

	for (const [key, value] of Object.entries(env)) {
		args.push("-e", `${key}=${value}`);
	}

	args.push(imageTag);

	const result = await runCommand({
		command: "docker",
		args,
		deploymentId,
		failureMessage: "Failed to start container",
		failureDetails: {
			imageTag,
			containerName,
			network,
			port,
		},
		buffer: true,
	});

	const containerId =
		typeof result.stdout === "string" ? result.stdout.trim() : "";

	logger.info({
		deploymentId,
		containerId,
		containerName,
		port,
	}, "Container started successfully");

	await addRoute({
		domain,
		upstreamHost: containerName,
		upstreamPort: port,
	});

	const liveUrl = `http://${domain}`;

	return {
		containerName,
		containerId,
		port,
		domain,
		liveUrl,
	};
}

// type LoadImageOptions = {
// 	deploymentId: string;
// 	tarPath: string;
// };

// export async function loadDockerImage(opts: LoadImageOptions): Promise<string> {
// 	const { deploymentId, tarPath } = opts;

// 	logger.info("Loading Docker image", { deploymentId, tarPath });

// 	const result = await runCommand({
// 		command: "docker",
// 		args: ["load", "-i", tarPath],
// 		deploymentId,
// 		failureMessage: "Failed to load Docker image",
// 		failureDetails: { tarPath },
// 		buffer: true,
// 	});

// 	logger.info("Docker load result", { result });

// 	// docker load outputs: "Loaded image: <tag>" or "Loaded image ID: <id>"
// 	const output = result.stdout != null ? String(result.stdout).trim() : "";
// 	const match = output.match(/Loaded image(?:\sID)?:\s*(.+)/);
// 	const imageTag = match?.[1]?.trim();
// 	if (!imageTag) {
// 		throw new Error(
// 			`Could not parse image tag from docker load output: ${output}`,
// 		);
// 	}

// 	logger.info("Docker image loaded successfully", {
// 		deploymentId,
// 		tarPath,
// 		imageTag,
// 	});

// 	return imageTag;
// }
