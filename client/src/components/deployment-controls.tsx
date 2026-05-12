import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Play, Square, Trash2 } from "lucide-react";
import {
	deleteDeployment,
	startDeployment,
	stopDeployment,
} from "@/lib/api/action";
import type { Deployment } from "./deployment-list";
import { DeploymentStatus } from "./deployment-status";
import { Button } from "./ui/button";

interface DeploymentControlsProps {
	deployment: Deployment;
	onDelete?: () => void;
}

export default function DeploymentControls({
	deployment,
	onDelete,
}: DeploymentControlsProps) {
	const { mutate: start, isPending: isStarting } = useMutation({
		mutationFn: () => startDeployment(deployment.slug),
	});

	const { mutate: stop, isPending: isStopping } = useMutation({
		mutationFn: () => stopDeployment(deployment.slug),
	});

	const { mutate: remove, isPending: isDeleting } = useMutation({
		mutationFn: () => deleteDeployment(deployment.slug),
		onSuccess: onDelete,
	});

	return (
		<div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
			<div>
				<div className="flex items-baseline gap-3">
					<h2 className="text-2xl font-bold text-slate-900">Live Logs</h2>
					<span className="text-lg font-semibold text-slate-700">
						{deployment.name}
					</span>
				</div>
				<div className="mt-2 flex items-center gap-3">
					<DeploymentStatus status={deployment.status} />
					{deployment.status === "live" && deployment.liveUrl && (
						<a
							href={deployment.liveUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
						>
							<ExternalLink className="w-3.5 h-3.5" />
							{deployment.liveUrl}
						</a>
					)}
				</div>
			</div>
			<div className="flex gap-2 shrink-0">
				<Button
					onClick={() => start()}
					disabled={
						isStarting ||
						deployment.status === "live" ||
						deployment.status === "deploying"
					}
					className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
				>
					<Play className="w-4 h-4" />
					{isStarting ? "Starting..." : "Start"}
				</Button>
				<Button
					onClick={() => stop()}
					disabled={isStopping || deployment.status !== "live"}
					className="bg-amber-600 hover:bg-amber-700 text-white gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
				>
					<Square className="w-4 h-4" />
					{isStopping ? "Stopping..." : "Stop"}
				</Button>
				<Button
					onClick={() => {
						if (!confirm(`Delete deployment "${deployment.name}"?`)) return;
						remove();
					}}
					disabled={isDeleting || deployment.status !== "stopped"}
					className="bg-red-600 hover:bg-red-700 text-white gap-2"
				>
					<Trash2 className="w-4 h-4" />
					{isDeleting ? "Deleting..." : "Delete"}
				</Button>
			</div>
		</div>
	);
}
