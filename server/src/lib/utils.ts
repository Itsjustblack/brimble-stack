import { execa, ExecaError } from "execa";
import type { Readable } from "node:stream";
import { internalError } from "./errors.js";
import { logger } from "./logger.js";
import { GITHUB_NAMESPACE } from "./constants.js";

export function getImageTag(deploymentId: string) {
	return `${GITHUB_NAMESPACE}/deploy-${deploymentId}:latest`;
}

export async function getImagePort(deploymentId: string): Promise<string[]> {
	const imageName = getImageTag(deploymentId);

	const inspectResult = await runCommand({
		command: "docker",
		args: ["inspect", imageName, "--format", "{{json .Config.ExposedPorts}}"],
		deploymentId,
		failureMessage: "Failed to inspect Docker image ports",
		failureDetails: { imageName },
		buffer: true,
	});

	const stdout = inspectResult.stdout;
	const output = typeof stdout === "string" ? stdout.trim() : "";
	const exposedPorts: Record<string, unknown> | null = output
		? JSON.parse(output)
		: null;

	if (!exposedPorts) {
		logger.info("No exposed ports found", { deploymentId, imageName });
		return [];
	}

	const ports = [
		...new Set(Object.keys(exposedPorts).map((port) => port.split("/")[0]!)),
	];
	logger.info("Exposed ports", { deploymentId, imageName, ports });

	return ports;
}

type RunStepArgs = {
	command: string;
	args: string[];
	deploymentId: string;
	failureMessage: string;
	failureDetails: Record<string, unknown>;
	buffer?: boolean;
};

export async function runCommand(
	step: RunStepArgs,
): Promise<Awaited<ReturnType<typeof execa>>> {
	const {
		command,
		args,
		deploymentId,
		failureMessage,
		failureDetails,
		buffer = false,
	} = step;
	const subprocess = execa(command, args, {
		stdout: "pipe",
		stderr: "pipe",
		buffer,
	});

	console.log({ deploymentId, command, stream: "stdout" });

	streamLines(subprocess.stdout, (line) => {
		logger.info(line, { stream: "stdout" });
	});

	streamLines(subprocess.stderr, (line) => {
		logger.error(line, { stream: "stderr" });
	});

	try {
		return await subprocess;
	} catch (err) {
		if (err instanceof ExecaError) {
			throw internalError(failureMessage, {
				deploymentId,
				command,
				exitCode: err.exitCode,
				message: err.originalMessage,
				...failureDetails,
			});
		}
		throw internalError(`Unexpected error while running ${command}.`, {
			deploymentId,
			command,
			...failureDetails,
		});
	}
}

export function streamLines(
	stream: Readable | null | undefined,
	onLine: (line: string) => void,
) {
	if (!stream) return;

	let buffer = "";
	stream.setEncoding("utf8");
	stream.on("data", (chunk: string) => {
		buffer += chunk;
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
			if (line.length > 0) onLine(line);
			buffer = buffer.slice(newlineIndex + 1);
			newlineIndex = buffer.indexOf("\n");
		}
	});
	stream.on("end", () => {
		const trailing = buffer.replace(/\r$/, "");
		if (trailing.length > 0) onLine(trailing);
	});
}
