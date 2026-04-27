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
import { runRailpackBuild, runRailpackPrepare } from "./pipeline/railpack.js";

const REPO_BASE_PATH = env.REPO_DIR;

const buildWorker = new Worker(
	"build-queue",
	async (job) => {
		const { deploymentId, repoUrl } = job.data;

		logger.info(
			{
				jobName: job.name,
				queueName: job.queueName,
				data: job.data,
			},
			"Processing build job",
		);

		const repoDirectory = join(REPO_BASE_PATH, deploymentId);
		const imageTag = getImageTag(deploymentId);

		try {
			await updateDeploymentStatus(deploymentId, "cloning");

			await mkdir(repoDirectory, { recursive: true });

			await cloneGitRepo(repoUrl, {
				deploymentId,
				destinationPath: repoDirectory,
			});

			await updateDeploymentStatus(deploymentId, "building");

			await runRailpackPrepare(repoDirectory, {
				deploymentId,
			});

			await runRailpackBuild(repoDirectory, {
				imageTag,
				deploymentId,
			});

			await updateDeployment(deploymentId, { imageTag });
			await updateDeploymentStatus(deploymentId, "ready");

			const { containerId, port, liveUrl } = await startDockerContainer({
				deploymentId,
				imageTag,
				domain: `${deploymentId}.localhost`,
			});

			await updateDeployment(deploymentId, {
				containerId,
				port,
				liveUrl,
			});
			await updateDeploymentStatus(deploymentId, "live");

			logger.info(
				{
					deploymentId,
					containerId,
					port,
					liveUrl,
					imageTag,
				},
				"Deployment live",
			);
		} catch (err) {
			await updateDeploymentStatus(deploymentId, "failed").catch(
				(updateErr) => {
					logger.error(
						{
							deploymentId,
							error: (updateErr as Error).message,
						},
						"Failed to mark deployment as failed",
					);
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
	logger.info(
		{
			jobId: job.id,
			deploymentId: job.data.deploymentId,
		},
		"Build job started",
	);
});

buildWorker.on("completed", (job) => {
	logger.info(
		{
			jobId: job.id,
			deploymentId: job.data.deploymentId,
		},
		"Build job completed",
	);
});

buildWorker.on("failed", (job, error) => {
	logger.error(
		{
			jobId: job?.id,
			deploymentId: job?.data?.deploymentId,
			error: error.message,
			stack: error.stack,
		},
		"Build job failed",
	);
});

buildWorker.on("error", (error) => {
	logger.error(
		{
			error: error.message,
			stack: error.stack,
		},
		"Build worker error",
	);
});

logger.info(
	{
		nodeEnv: env.NODE_ENV,
		repoBasePath: REPO_BASE_PATH,
	},
	"Build worker started",
);

const shutdown = async (signal: string) => {
	logger.info({ signal }, "Shutting down worker");
	await buildWorker.close();
	process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
