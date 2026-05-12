import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getLogger } from "../lib/logger.js";
import { runCommand } from "../lib/utils.js";

function computeSecretsHash(env: Record<string, string>): string {
	const sorted = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));
	return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

type RailpackPaths = {
	planDir: string;
	planPath: string;
	infoPath: string;
};

type RunRailpackPrepareOptions = {
	slug: string;
	env?: Record<string, string>;
};

// Pinned by digest — skip per-build manifest resolution against ghcr.io.
// To update: docker pull ghcr.io/railwayapp/railpack-frontend:latest && docker inspect --format='{{index .RepoDigests 0}}'
const RAILPACK_FRONTEND_IMAGE =
	"ghcr.io/railwayapp/railpack-frontend@sha256:ba4c430961d9ee3215c64807727a4b11e2198daac31250e9db9eaf9cee4624d6";

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
	const { slug, env = {} } = opts;
	const { planDir, planPath, infoPath } = railpackPaths(repoDirectory);

	await mkdir(planDir, { recursive: true });

	getLogger().info({
		slug,
		repoDirectory,
		planPath,
		infoPath,
		envKeys: Object.keys(env),
	}, "Railpack prepare started");

	const prepareArgs: string[] = [
		"prepare",
		repoDirectory,
		"--plan-out",
		planPath,
		"--info-out",
		infoPath,
	];

	for (const [key, value] of Object.entries(env)) {
		prepareArgs.push("--env", `${key}=${value}`);
	}

	await runCommand({
		command: "railpack",
		args: prepareArgs,
		slug,
		failureMessage: "Railpack prepare failed",
		failureDetails: {
			repoDirectory,
			planPath,
			infoPath,
		},
	});

	getLogger().info({
		slug,
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
	slug: string;
	env?: Record<string, string>;
};

export async function runRailpackBuild(
	repoDirectory: string,
	opts: RunRailpackBuildOptions,
) {
	const { slug, imageTag, env = {} } = opts;
	const { planPath } = railpackPaths(repoDirectory);

	getLogger().info({
		slug,
		imageTag,
		repoDirectory,
		planPath,
	}, "Railpack build started");

	const buildArgs: string[] = [
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
	];

	// Railpack treats user env vars as BuildKit secrets, not build-args.
	// Names are registered in the plan via `railpack prepare --env`; values
	// are mounted at build time via `--secret id=KEY,env=KEY`, reading from
	// the subprocess environment. `secrets-hash` busts the layer cache when
	// any value changes (BuildKit doesn't invalidate on secret content).
	const envKeys = Object.keys(env);
	if (envKeys.length > 0) {
		for (const key of envKeys) {
			buildArgs.push("--secret", `id=${key},env=${key}`);
		}
		buildArgs.push("--build-arg", `secrets-hash=${computeSecretsHash(env)}`);
	}

	buildArgs.push(
		// railpack-generated build plan
		"-f",
		planPath,

		// repo source context
		repoDirectory,
	);

	await runCommand({
		command: "docker",
		args: buildArgs,
		slug,
		...(envKeys.length > 0 ? { env } : {}),
		failureMessage: "Railpack build failed",
		failureDetails: {
			slug,
			imageTag,
			repoDirectory,
			planPath,
		},
	});

	getLogger().info({
		slug,
		imageTag,
	}, "Railpack build completed");
}

export async function warmRailpackFrontend(): Promise<void> {
	getLogger().info({ image: RAILPACK_FRONTEND_IMAGE }, "Pre-pulling railpack frontend image");
	await runCommand({
		command: "docker",
		args: ["pull", RAILPACK_FRONTEND_IMAGE],
		slug: "worker-init",
		failureMessage: "Failed to pre-pull railpack frontend image",
		failureDetails: { image: RAILPACK_FRONTEND_IMAGE },
	});
	getLogger().info({ image: RAILPACK_FRONTEND_IMAGE }, "Railpack frontend image warm");
}

type StopContainerOptions = {
	containerId: string;
	slug: string;
	force?: boolean;
};

export async function stopContainer(
	opts: StopContainerOptions,
): Promise<void> {
	const { containerId, slug, force = false } = opts;

	getLogger().info({
		slug,
		containerId,
		force,
	}, "Stopping container");

	const stopCommand = force ? "kill" : "stop";

	await runCommand({
		command: "docker",
		args: [stopCommand, containerId],
		slug,
		failureMessage: `Failed to ${stopCommand} container`,
		failureDetails: {
			containerId,
			force,
		},
	});

	getLogger().info({
		slug,
		containerId,
		force,
	}, "Container stopped");
}
