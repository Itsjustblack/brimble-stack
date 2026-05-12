import { decrypt, encrypt } from "../../lib/encryption.js";
import { notFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import type { EnvMap } from "./env.validation.js";

const resolveDeploymentId = async (slug: string): Promise<string> => {
	const deployment = await prisma.deployment.findUnique({
		where: { slug },
		select: { id: true },
	});
	if (!deployment) {
		throw notFound("Deployment not found.");
	}
	return deployment.id;
};

export const setEnvVars = async (slug: string, vars: EnvMap) => {
	const deploymentId = await resolveDeploymentId(slug);
	const entries = Object.entries(vars);

	await prisma.$transaction(async (tx) => {
		await tx.deploymentEnv.deleteMany({ where: { deploymentId } });

		if (entries.length === 0) return;

		await tx.deploymentEnv.createMany({
			data: entries.map(([key, value]) => ({
				deploymentId,
				key,
				value: encrypt(value),
			})),
		});
	});
};

export const listEnvVars = async (slug: string) => {
	const rows = await prisma.deploymentEnv.findMany({
		where: { deployment: { slug } },
		select: { key: true, createdAt: true, updatedAt: true },
		orderBy: { key: "asc" },
	});
	return rows;
};

export const getEnvVarsDecrypted = async (
	slug: string,
): Promise<Record<string, string>> => {
	const rows = await prisma.deploymentEnv.findMany({
		where: { deployment: { slug } },
		select: { key: true, value: true },
	});

	const result: Record<string, string> = {};
	for (const row of rows) {
		result[row.key] = decrypt(row.value);
	}
	return result;
};

export const upsertEnvVar = async (
	slug: string,
	key: string,
	value: string,
) => {
	const deploymentId = await resolveDeploymentId(slug);
	const encrypted = encrypt(value);
	const row = await prisma.deploymentEnv.upsert({
		where: { deploymentId_key: { deploymentId, key } },
		create: { deploymentId, key, value: encrypted },
		update: { value: encrypted },
		select: { key: true, createdAt: true, updatedAt: true },
	});
	return row;
};

export const deleteEnvVar = async (slug: string, key: string) => {
	const result = await prisma.deploymentEnv.deleteMany({
		where: { deployment: { slug }, key },
	});

	if (result.count === 0) {
		throw notFound("Env var not found.");
	}
};
