import { rm } from "node:fs/promises";
import { internalError } from "../lib/errors.js";
import { runCommand } from "../lib/utils.js";
import { getLogger } from "../lib/logger.js";

type CloneGitRepoOptions = {
	slug: string;
	destinationPath?: string;
};

export async function cloneGitRepo(url: string, opts: CloneGitRepoOptions) {
	const { slug, destinationPath } = opts;

	const args = ["clone", "--depth", "1", url];
	if (destinationPath) {
		args.push(destinationPath);
	}

	getLogger().info({ url, destinationPath }, "Cloning Repository");

	await runCommand({
		command: "git",
		args,
		slug,
		failureMessage: "Unexpected error while cloning repository.",
		failureDetails: { url, destinationPath },
	});

	getLogger().info({ url, destinationPath }, "Repository Clone complete");
}

type DeleteGitRepoOptions = {
	slug: string;
};

export async function deleteGitRepo(
	repoPath: string,
	opts: DeleteGitRepoOptions,
) {
	const { slug } = opts;

	getLogger().info({ slug, repoPath }, "Deleting repository");

	try {
		await rm(repoPath, { recursive: true, force: true });
	} catch (err) {
		throw internalError("Failed to delete repository.", {
			slug,
			repoPath,
			cause: err instanceof Error ? err.message : String(err),
		});
	}

	getLogger().info({ slug, repoPath }, "Repository deleted");
}
