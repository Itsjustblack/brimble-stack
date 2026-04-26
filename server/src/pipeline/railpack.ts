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
	buildDirectory: string;
};

const RAILPACK_FRONTEND_IMAGE = "ghcr.io/railwayapp/railpack-frontend:latest";

function railpackPaths(buildDirectory: string): RailpackPaths {
	const planDir = join(buildDirectory, ".railpack");
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
	const { deploymentId, buildDirectory } = opts;
	const { planDir, planPath, infoPath } = railpackPaths(buildDirectory);

	await mkdir(planDir, { recursive: true });

	logger.info("Railpack prepare started", {
		deploymentId,
		repoDirectory,
		planPath,
		infoPath,
	});

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

	logger.info("Railpack prepare completed", {
		deploymentId,
		planPath,
		infoPath,
	});

	return {
		planDir,
		planPath,
		infoPath,
	};
}

type RunRailpackBuildOptions = {
	imageTag: string;
	deploymentId: string;
	buildDirectory: string;
};

export async function runRailpackBuild(
	repoDirectory: string,
	opts: RunRailpackBuildOptions,
) {
	const { deploymentId, imageTag, buildDirectory } = opts;
	const { planPath } = railpackPaths(buildDirectory);

	logger.info("Railpack build started", {
		deploymentId,
		imageTag,
		repoDirectory,
		planPath,
	});

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

	logger.info("Railpack build completed", {
		deploymentId,
		imageTag,
	});
}
