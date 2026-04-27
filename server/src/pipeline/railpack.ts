import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../lib/logger.js";
import { runCommand } from "../lib/utils.js";

type RailpackPaths = {
	planDir: string;
	planPath: string;
	infoPath: string;
};

type RunRailpackPrepareOptions = {
	deploymentId: string;
};

const RAILPACK_FRONTEND_IMAGE = "ghcr.io/railwayapp/railpack-frontend:latest";

function railpackPaths(repoDirectory: string): RailpackPaths {
	const planDir = join(repoDirectory, ".railpack");
	const planPath = join(planDir, "railpack-plan.json");
	const infoPath = join(planDir, "railpack-info.json");

	return {
		planDir,
		planPath,
		infoPath,
	};
}

export async function runRailpackPrepare(
	repoDirectory: string,
	opts: RunRailpackPrepareOptions,
): Promise<RailpackPaths> {
	const { deploymentId } = opts;
	const { planDir, planPath, infoPath } = railpackPaths(repoDirectory);

	await mkdir(planDir, { recursive: true });

	logger.info({
		deploymentId,
		repoDirectory,
		planPath,
		infoPath,
	}, "Railpack prepare started");

	await runCommand({
		command: "railpack",
		args: [
			"prepare",
			repoDirectory,
			"--plan-out",
			planPath,
			"--info-out",
			infoPath,
		],
		deploymentId,
		failureMessage: "Railpack prepare failed",
		failureDetails: {
			repoDirectory,
			planPath,
			infoPath,
		},
	});

	logger.info({
		deploymentId,
		planPath,
		infoPath,
	}, "Railpack prepare completed");

	return {
		planDir,
		planPath,
		infoPath,
	};
}

type RunRailpackBuildOptions = {
	imageTag: string;
	deploymentId: string;
};

export async function runRailpackBuild(
	repoDirectory: string,
	opts: RunRailpackBuildOptions,
) {
	const { deploymentId, imageTag } = opts;
	const { planPath } = railpackPaths(repoDirectory);

	logger.info({
		deploymentId,
		imageTag,
		repoDirectory,
		planPath,
	}, "Railpack build started");

	await runCommand({
		command: "docker",
		args: [
			"buildx",
			"build",

			// Load final image into local Docker daemon
			"--load",

			// tag image
			"-t",
			imageTag,

			// tell Docker to use Railpack frontend
			"--build-arg",
			`BUILDKIT_SYNTAX=${RAILPACK_FRONTEND_IMAGE}`,

			// railpack-generated build plan
			"-f",
			planPath,

			// repo source context
			repoDirectory,
		],
		deploymentId,
		failureMessage: "Railpack build failed",
		failureDetails: {
			deploymentId,
			imageTag,
			repoDirectory,
			planPath,
		},
	});

	logger.info({
		deploymentId,
		imageTag,
	}, "Railpack build completed");
}
