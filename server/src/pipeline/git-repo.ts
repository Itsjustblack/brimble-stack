import { rm } from "node:fs/promises";
import { ZodError, z } from "zod";
import { internalError, validationError } from "../lib/errors.js";
import { runCommand } from "../lib/utils.js";
import { logger } from "../lib/logger.js";

const gitRepoUrlSchema = z.url("Repository URL must be a valid URL.");

type CloneGitRepoOptions = {
	deploymentId: string;
	destinationPath?: string;
};

export async function cloneGitRepo(url: string, opts: CloneGitRepoOptions) {
	const { deploymentId, destinationPath } = opts;

	let parsedUrl: string;
	try {
		parsedUrl = gitRepoUrlSchema.parse(url);
	} catch (err) {
		if (err instanceof ZodError) {
			throw validationError("Repository URL validation failed.", {
				url,
				errors: z.treeifyError(err),
			});
		}
		throw err;
	}

	const args = ["clone", "--depth", "1", parsedUrl];
	if (destinationPath) {
		args.push(destinationPath);
	}

	logger.info({ url, destinationPath }, "Cloning Repository");

	await runCommand({
		command: "git",
		args,
		deploymentId,
		failureMessage: "Unexpected error while cloning repository.",
		failureDetails: { url, destinationPath },
	});

	logger.info({ url, destinationPath }, "Repository Clone complete");
}

type DeleteGitRepoOptions = {
	deploymentId: string;
};

export async function deleteGitRepo(
	repoPath: string,
	opts: DeleteGitRepoOptions,
) {
	const { deploymentId } = opts;

	try {
		await rm(repoPath, { recursive: true, force: true });
	} catch (err) {
		throw internalError("Failed to delete repository.", {
			deploymentId,
			repoPath,
			cause: err instanceof Error ? err.message : String(err),
		});
	}
}
