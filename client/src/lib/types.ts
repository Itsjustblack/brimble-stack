import type z from "zod";
import type { deploymentFormSchema, envVariableSchema } from "./validation";

export type EnvVariable = z.infer<typeof envVariableSchema>;
export type DeploymentFormValues = z.infer<typeof deploymentFormSchema>;
