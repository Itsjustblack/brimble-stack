import { getLogger } from "../lib/logger.js";
import { getImageTag, runCommand } from "../lib/utils.js";
import { addRoute, removeRoute } from "./proxy.js";

type StartContainerOptions = {
	slug: string;
	imageTag: string;
	domain: string;
	port?: number;
	network?: string;
	env?: Record<string, string>;
};

export async function startContainer(opts: StartContainerOptions) {
	const {
		slug,
		imageTag,
		domain,
		port = 3000,
		network = "mini-paas-network",
		env = {},
	} = opts;

	const containerName = `deployment-${slug}`;

	getLogger().info(
		{
			slug,
			imageTag,
			containerName,
			port,
			network,
		},
		"Starting container",
	);

	const args = [
		"run",
		"-d",
		"--name",
		containerName,
		"--network",
		network,
		"--restart",
		"unless-stopped",
		"-e",
		`PORT=${port}`,
	];

	for (const [key, value] of Object.entries(env)) {
		args.push("-e", `${key}=${value}`);
	}

	args.push(imageTag);

	try {
		const result = await runCommand({
			command: "docker",
			args,
			slug,
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

		getLogger().info(
			{
				slug,
				containerId,
				containerName,
				port,
			},
			"Container started successfully",
		);

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
	} catch (err) {
		getLogger().error(
			{ slug, imageTag, containerName, error: (err as Error).message },
			"Failed to start container",
		);
		throw err;
	}
}

export async function stopContainer(slug: string, domain: string) {
	const containerName = `deployment-${slug}`;

	getLogger().info({ slug, containerName }, "Stopping container");

	await removeRoute(domain).catch((err) =>
		getLogger().warn(
			{ slug, domain, error: (err as Error).message },
			"Failed to remove route, continuing cleanup",
		),
	);

	await runCommand({
		command: "docker",
		args: ["stop", containerName],
		slug,
		failureMessage: "Failed to stop container",
		failureDetails: { containerName },
		buffer: true,
	}).catch((err) =>
		getLogger().warn(
			{ slug, containerName, error: (err as Error).message },
			"docker stop failed (container may not exist), continuing",
		),
	);

	await runCommand({
		command: "docker",
		args: ["rm", "-f", containerName],
		slug,
		failureMessage: "Failed to remove container",
		failureDetails: { containerName },
		buffer: true,
	}).catch((err) =>
		getLogger().warn(
			{ slug, containerName, error: (err as Error).message },
			"docker rm failed (container may not exist)",
		),
	);

	getLogger().info({ slug, containerName }, "Container stopped and removed");
}

export async function deleteContainerImage(slug: string) {
	const imageName = getImageTag(slug);

	getLogger().info({ slug, imageName }, "Deleting image");

	runCommand({
		command: "docker",
		args: ["rmi", imageName],
		slug,
		failureMessage: "Failed to remove image",
		failureDetails: { imageName },
		buffer: true,
	}).catch((err) =>
		getLogger().warn(
			{ slug, imageName, error: (err as Error).message },
			"docker rmi failed (image may not exist), continuing",
		),
	);

	getLogger().info({ slug, imageName }, "Image deleted");
}
