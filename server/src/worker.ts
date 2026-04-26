import { Worker } from "bullmq";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { REDIS_CONNECTION } from "./lib/redis.js";
import { getImageTag } from "./lib/utils.js";
import {
	updateDeployment,
	updateDeploymentStatus,
} from "./modules/deployment/deployment.service.js";
import { startContainer as startDockerContainer } from "./pipeline/deploy.js";
import { cloneGitRepo } from "./pipeline/git-repo.js";
import {
	runRailpackBuild,
	runRailpackPrepare,
} from "./pipeline/railpack.js";

const REPO_BASE_PATH = process.env.REPO_DIR || join(process.cwd(), "repos");
const BUILD_WORKSPACE_PATH =
	process.env.BUILD_DIR || join(process.cwd(), "tmp");

const buildWorker = new Worker(
	"build-queue",
	async (job) => {
		const { deploymentId, repoUrl } = job.data;

		logger.info("Processing build job", {
			jobName: job.name,
			queueName: job.queueName,
			data: job.data,
		});

		const repoDirectory = join(REPO_BASE_PATH, deploymentId);
		const buildDirectory = join(BUILD_WORKSPACE_PATH, deploymentId);
		const imageTag = getImageTag(deploymentId);

		try {
			await updateDeploymentStatus(deploymentId, "cloning");

			// persist cloned repo
			await mkdir(repoDirectory, { recursive: true });

			await cloneGitRepo(repoUrl, {
				deploymentId,
				destinationPath: repoDirectory,
			});

			await updateDeploymentStatus(deploymentId, "building");

			// temp workspace for railpack/build artifacts
			await mkdir(buildDirectory, { recursive: true });

			await runRailpackPrepare(repoDirectory, {
				deploymentId,
				buildDirectory,
			});

			await runRailpackBuild(repoDirectory, {
				imageTag,
				deploymentId,
				buildDirectory,
			});

			await updateDeployment(deploymentId, { imageTag });
			await updateDeploymentStatus(deploymentId, "ready");

			const { containerId, port, liveUrl } = await startDockerContainer({
				deploymentId,
				imageTag,
				domain: `${deploymentId}.localhost`,
			});

			await updateDeployment(deploymentId, { containerId, port, liveUrl });
			await updateDeploymentStatus(deploymentId, "live");

			// start container
		} catch (err) {
			await updateDeploymentStatus(deploymentId, "failed").catch(
				(updateErr) => {
					logger.error("Failed to mark deployment as failed", {
						deploymentId,
						error: (updateErr as Error).message,
					});
				},
			);

			throw err;
		}
	},
	{
		connection: REDIS_CONNECTION,
	},
);

buildWorker.on("active", (job) => {
	logger.info("Build job started", {
		jobId: job.id,
		deploymentId: job.data.deploymentId,
	});
});

buildWorker.on("completed", (job) => {
	logger.info("Build job completed", {
		jobId: job.id,
		deploymentId: job.data.deploymentId,
	});
});

buildWorker.on("failed", (job, error) => {
	logger.error("Build job failed", {
		jobId: job?.id,
		deploymentId: job?.data?.deploymentId,
		error: error.message,
		stack: error.stack,
	});
});

buildWorker.on("error", (error) => {
	logger.error("Build worker error", {
		error: error.message,
		stack: error.stack,
	});
});

logger.info("Build worker started", {
	nodeEnv: env.NODE_ENV,
	repoBasePath: REPO_BASE_PATH,
	buildWorkspacePath: BUILD_WORKSPACE_PATH,
});

const shutdown = async (signal: string) => {
	logger.info("Shutting down worker", { signal });
	await buildWorker.close();
	process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
