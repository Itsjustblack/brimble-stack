import { EnvVariablesModal } from "@/components/env-variables-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	createDeployment,
	type CreateDeploymentPayload,
} from "@/lib/api/action";
import type { DeploymentFormValues } from "@/lib/types";
import { parseEnvFile } from "@/lib/utils";
import { deploymentFormSchema } from "@/lib/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

export function DeploymentForm() {
	const [showEnvModal, setShowEnvModal] = useState(false);

	const form = useForm<DeploymentFormValues>({
		resolver: zodResolver(deploymentFormSchema),
		mode: "onChange",
		defaultValues: {
			name: "",
			repoUrl: "",
		},
	});

	const env = useWatch({ control: form.control, name: "env" }) || [];

	const { mutate, isPending, error } = useMutation({
		mutationFn: createDeployment,
		onSuccess: () => {
			form.reset({ name: "", repoUrl: "" });
		},
	});

	const handleImportEnv = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];

		if (!file) return;

		const reader = new FileReader();

		reader.onload = (event) => {
			const content = event.target?.result as string;

			const parsedEnvVars = parseEnvFile(content);

			form.setValue("env", parsedEnvVars);
		};

		reader.readAsText(file);
	};

	const onSubmit = (data: DeploymentFormValues) => {
		const payload: CreateDeploymentPayload = {
			name: data.name,
			repoUrl: data.repoUrl,
			env: (data.env ?? []).reduce<Record<string, string>>(
				(acc, { key, value }) => {
					if (key) acc[key] = value;
					return acc;
				},
				{},
			),
		};
		mutate(payload);
	};

	return (
		<FormProvider {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-6 p-6 border border-slate-200 rounded-lg bg-white shadow-sm"
			>
				<div className="space-y-4">
					<div>
						<Label
							htmlFor="deployment-name"
							className="text-sm font-medium text-slate-900"
						>
							Deployment Name
						</Label>
						<Input
							id="deployment-name"
							placeholder="My App v1.0"
							className="mt-2 rounded-[10px]"
							{...form.register("name")}
						/>
						{form.formState.errors.name && (
							<p className="text-sm text-red-500 mt-1">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					<div>
						<Label
							htmlFor="deployment-url"
							className="text-sm font-medium text-slate-900"
						>
							Repository URL
						</Label>
						<Input
							id="deployment-url"
							type="url"
							placeholder="https://github.com/user/repo"
							className="mt-2 rounded-[10px]"
							{...form.register("repoUrl")}
						/>
						{form.formState.errors.repoUrl && (
							<p className="text-sm text-red-500 mt-1">
								{form.formState.errors.repoUrl.message}
							</p>
						)}
					</div>

					{error && (
						<p className="text-sm text-red-500">{(error as Error).message}</p>
					)}

					<Button
						type="submit"
						className="w-full bg-blue-600 hover:bg-blue-700 text-white"
						disabled={isPending}
					>
						{isPending ? "Creating..." : "Create Deployment"}
					</Button>
				</div>

				<div className="border-t border-slate-200 pt-6">
					<div className="flex gap-2">
						<label
							htmlFor="env-import"
							className="flex-1"
						>
							<Button
								type="button"
								className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
								asChild
							>
								<span>Import .env</span>
							</Button>
							<input
								id="env-import"
								type="file"
								accept=".env,text/plain"
								onChange={handleImportEnv}
								className="hidden"
							/>
						</label>
						<Button
							type="button"
							className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
							onClick={() => setShowEnvModal(true)}
						>
							<Plus className="w-4 h-4" />
							Add More
						</Button>
					</div>

					{env.length > 0 && (
						<div className="mt-4 space-y-2">
							<p className="text-xs font-medium text-slate-900">
								Added Variables:
							</p>
							<div className="flex flex-wrap gap-2">
								{env.map((field) => (
									<div
										key={field.key}
										className="inline-flex items-center px-3 py-1 bg-slate-100 rounded text-xs text-slate-700"
									>
										<span className="font-mono">{field.key || "unnamed"}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<EnvVariablesModal
					open={showEnvModal}
					onOpenChange={setShowEnvModal}
				/>
			</form>
		</FormProvider>
	);
}
