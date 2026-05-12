import { execa, ExecaError } from "execa";
import { customAlphabet } from "nanoid";
import type { Readable } from "node:stream";
import { internalError } from "./errors.js";
import { getLogger } from "./logger.js";

const GITHUB_NAMESPACE = "brimble-stack";
const SLUG_NAME_MAX = 32;
const SLUG_SUFFIX_LEN = 6;
const nanoSlug = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", SLUG_SUFFIX_LEN);

export function slugifyName(name: string): string {
	const cleaned = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, SLUG_NAME_MAX)
		.replace(/-+$/g, "");
	return cleaned.length > 0 ? cleaned : "app";
}

export function generateDeploymentSlug(name: string): string {
	return `${slugifyName(name)}-${nanoSlug()}`;
}

export function getImageTag(slug: string) {
	return `${GITHUB_NAMESPACE}/deploy-${slug}:latest`;
}

export const getDeploymentLogStreamKey = (slug: string) =>
	`deploy:${slug}:logstream`;

export const removeUndefinedFields = <T extends Record<string, unknown>>(
	data: T,
) =>
	Object.fromEntries(
		Object.entries(data).filter(([, value]) => value !== undefined),
	) as T;

type RunStepArgs = {
	command: string;
	args: string[];
	slug: string;
	failureMessage: string;
	failureDetails: Record<string, unknown>;
	buffer?: boolean;
	env?: Record<string, string>;
};

export async function runCommand(
	step: RunStepArgs,
): Promise<Awaited<ReturnType<typeof execa>>> {
	const {
		command,
		args,
		slug,
		failureMessage,
		failureDetails,
		buffer = false,
		env,
	} = step;
	const subprocess = execa(command, args, {
		stdout: "pipe",
		stderr: "pipe",
		buffer,
		...(env ? { env } : {}),
	});

	streamLines(subprocess.stdout, (line) => {
		getLogger().debug({ slug, command, stream: "stdout" }, line);
	});

	streamLines(subprocess.stderr, (line) => {
		getLogger().warn({ slug, command, stream: "stderr" }, line);
	});

	try {
		return await subprocess;
	} catch (err) {
		if (err instanceof ExecaError) {
			throw internalError(failureMessage, {
				slug,
				command,
				exitCode: err.exitCode,
				message: err.originalMessage,
				...failureDetails,
			});
		}
		throw internalError(`Unexpected error while running ${command}.`, {
			slug,
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
