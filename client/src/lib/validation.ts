import z from "zod";

export const gitRepoURLSchema = z.url().refine(
	(value) => {
		const patterns = [
			/^https?:\/\/github\.com\/[^/]+\/[^/]+(\.git)?\/?$/,
			/^https?:\/\/gitlab\.com\/[^/]+\/[^/]+(\.git)?\/?$/,
			/^https?:\/\/bitbucket\.org\/[^/]+\/[^/]+(\.git)?\/?$/,
		];

		return patterns.some((pattern) => pattern.test(value));
	},
	{
		message: "Not a valid Git repository URL",
	},
);

export const envVariableSchema = z.object({
	key: z.string().min(1, "Variable name is required"),
	value: z.string().min(1, "Variable value is required"),
});

export const deploymentFormSchema = z.object({
	name: z.string().trim().min(1, "name is required."),
	repoUrl: gitRepoURLSchema,
	env: z.array(envVariableSchema).optional(),
});
