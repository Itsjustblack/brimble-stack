import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { EnvVariable } from "./types";
import { envVariableSchema } from "./validation";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getLevelColor(level: number): string {
	if (level >= 50) return "text-red-400";
	if (level >= 40) return "text-yellow-400";
	if (level >= 30) return "text-zinc-100";
	return "text-zinc-400";
}

export function getLevelName(level: number): string {
	const levels: Record<number, string> = {
		10: "TRACE",
		20: "DEBUG",
		30: "INFO",
		40: "WARN",
		50: "ERROR",
		60: "FATAL",
	};
	return levels[level] || "UNKNOWN";
}

export function parseEnvFile(content: string): EnvVariable[] {
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#") && line.includes("="))
		.map((line) => {
			const [key, ...rest] = line.split("=");

			return {
				key: key.trim(),
				value: rest
					.join("=")
					.trim()
					.replace(/^['"]|['"]$/g, ""),
			};
		})
		.filter((env) => {
			const result = envVariableSchema.safeParse(env);
			return result.success;
		});
}
