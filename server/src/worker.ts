import { Worker, type Job } from "bullmq";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { env } from "./config/env.js";
import { getLogger, runWithLoggerContext, runWithSlug } from "./lib/logger.js";
import { BULLMQ_REDIS_CONNECTION } from "./lib/redis.js";
import { getImageTag } from "./lib/utils.js";
import {
	updateDeployment,
	updateDeploymentStatus,
} from "./modules/deployment/deployment.service.js";
import { getEnvVarsDecrypted } from "./modules/env/env.service.js";
import {
	deleteContainerImage,
	startContainer as startDockerContainer,
	stopContainer,
} from "./pipeline/deploy.js";
import { cloneGitRepo, deleteGitRepo } from "./pipeline/git-repo.js";
import {
	runRailpackBuild,
	runRailpackPrepare,
	warmRailpackFrontend,
} from "./pipeline/railpack.js";
import {
	buildQueue,
	type BuildJob,
	type BuildJobData,
	type DeleteContainerImageJob,
	type StartContainerJob,
	type StopContainerJob,
} from "./queues/build.queue.js";

const REPO_BASE_PATH = env.REPO_DIR;

async function handleBuildJob(job: Job<BuildJob>) {
	const { slug, repoUrl } = job.data;
	const repoDirectory = join(REPO_BASE_PATH, slug);
	const imageTag = getImageTag(slug);

	try {
		await updateDeploymentStatus(slug, "cloning");
		await mkdir(repoDirectory, { recursive: true });
		await cloneGitRepo(repoUrl, {
			slug,
			destinationPath: repoDirectory,
		});

		await updateDeploymentStatus(slug, "building");
		const buildEnv = await getEnvVarsDecrypted(slug);
		await runRailpackPrepare(repoDirectory, { slug, env: buildEnv });
		await runRailpackBuild(repoDirectory, { imageTag, slug, env: buildEnv });

		await deleteGitRepo(repoDirectory, { slug });

		await updateDeployment(slug, { imageTag });
		await updateDeploymentStatus(slug, "ready");

		await buildQueue.add("start_container", {
			type: "start_container",
			slug,
			imageTag,
			domain: `${slug}.localhost`,
		});
	} catch (err) {
		await updateDeploymentStatus(slug, "failed").catch((updateErr) => {
			getLogger().error(
				{ slug, error: (updateErr as Error).message },
				"Failed to mark deployment as failed",
			);
		});
		throw err;
	}
}

async function handleStartContainerJob(job: Job<StartContainerJob>) {
	const { slug, imageTag, domain, port } = job.data;

	try {
		await updateDeploymentStatus(slug, "deploying");

		const runtimeEnv = await getEnvVarsDecrypted(slug);

		const {
			containerId,
			port: assignedPort,
			liveUrl,
		} = await startDockerContainer({
			slug,
			imageTag,
			domain,
			env: runtimeEnv,
		});

		await updateDeployment(slug, {
			containerId,
			port: assignedPort,
			liveUrl,
		});
		await updateDeploymentStatus(slug, "live");

		getLogger().info(
			{
				slug,
				containerId,
				port: assignedPort,
				liveUrl,
				imageTag,
			},
			"Deployment live",
		);
	} catch (err) {
		await updateDeploymentStatus(slug, "failed").catch((updateErr) => {
			getLogger().error(
				{ slug, error: (updateErr as Error).message },
				"Failed to mark deployment as failed",
			);
		});
		throw err;
	}
}

async function handleStopContainerJob(job: Job<StopContainerJob>) {
	const { slug, domain } = job.data;

	try {
		await stopContainer(slug, domain);
		await updateDeploymentStatus(slug, "stopped");
	} catch (err) {
		await updateDeploymentStatus(slug, "failed").catch((updateErr) => {
			getLogger().error(
				{ slug, error: (updateErr as Error).message },
				"Failed to mark deployment as failed",
			);
		});
		throw err;
	}
}

async function handleDeleteContainerImageJob(
	job: Job<DeleteContainerImageJob>,
) {
	const { slug } = job.data;
	await deleteContainerImage(slug);
}

const buildWorker = new Worker<BuildJobData>(
	"build-queue",
	async (job) => {
		const jobLogger = getLogger().child({
			jobId: job.id,
			// queueName: job.queueName,
			// type: job.data.type,
			slug: job.data.slug,
		});

		return runWithLoggerContext(jobLogger, async () => {
			jobLogger.info("Processing job");

			if (job.data.type === "build") {
				return handleBuildJob(job as Job<BuildJob>);
			}
			if (job.data.type === "start_container") {
				return handleStartContainerJob(job as Job<StartContainerJob>);
			}
			if (job.data.type === "stop_container") {
				return handleStopContainerJob(job as Job<StopContainerJob>);
			}
			if (job.data.type === "delete_container_image") {
				return handleDeleteContainerImageJob(
					job as Job<DeleteContainerImageJob>,
				);
			}
			throw new Error(
				`Unknown job type: ${(job.data as { type: unknown }).type}`,
			);
		});
	},
	{ connection: BULLMQ_REDIS_CONNECTION },
);

buildWorker.on("active", (job) => {
	runWithSlug(job.data.slug, (l) =>
		l.info({ jobId: job.id, type: job.data.type }, "Job started"),
	);
});

buildWorker.on("completed", (job) => {
	runWithSlug(job.data.slug, (l) =>
		l.info({ jobId: job.id, type: job.data.type }, "Job completed"),
	);
});

buildWorker.on("failed", (job, error) => {
	runWithSlug(job?.data?.slug, (l) =>
		l.error(
			{
				jobId: job?.id,
				type: job?.data?.type,
				error: error.message,
				stack: error.stack,
			},
			"Job failed",
		),
	);
});

buildWorker.on("error", (error) => {
	getLogger().error(
		{ error: error.message, stack: error.stack },
		"Build worker error",
	);
});

getLogger().info(
	{ nodeEnv: env.NODE_ENV, repoBasePath: REPO_BASE_PATH },
	"Build worker started",
);

warmRailpackFrontend().catch((err) =>
	getLogger().warn({ error: (err as Error).message }, "Failed to pre-pull railpack frontend image"),
);

const shutdown = async (signal: string) => {
	getLogger().info({ signal }, "Shutting down worker");
	await buildWorker.close();
	process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
