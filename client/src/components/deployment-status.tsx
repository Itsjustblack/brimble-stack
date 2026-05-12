"use client";

import { Badge } from "@/components/ui/badge";
import type { Deploymentstatus } from "./deployment-list";

interface DeploymentStatusProps {
	status: Deploymentstatus;
	name?: string;
	id?: string;
}

const statusConfig: Record<
	Deploymentstatus,
	{ color: string; label: string; icon: string }
> = {
	pending: {
		color: "bg-slate-100 text-slate-700 border-slate-300",
		label: "Pending",
		icon: "◌",
	},
	cloning: {
		color: "bg-blue-100 text-blue-700 border-blue-300",
		label: "Cloning",
		icon: "↓",
	},
	building: {
		color: "bg-indigo-100 text-indigo-700 border-indigo-300",
		label: "Building",
		icon: "⚙",
	},
	ready: {
		color: "bg-cyan-100 text-cyan-700 border-cyan-300",
		label: "Ready",
		icon: "✓",
	},
	deploying: {
		color: "bg-amber-100 text-amber-700 border-amber-300",
		label: "Deploying",
		icon: "→",
	},
	live: {
		color: "bg-emerald-100 text-emerald-700 border-emerald-300",
		label: "Live",
		icon: "●",
	},
	failed: {
		color: "bg-red-100 text-red-700 border-red-300",
		label: "Failed",
		icon: "✕",
	},
	stopped: {
		color: "bg-orange-100 text-orange-700 border-orange-300",
		label: "Stopped",
		icon: "⊡",
	},
	cancelled: {
		color: "bg-rose-100 text-rose-700 border-rose-300",
		label: "Cancelled",
		icon: "✕",
	},
};

export function DeploymentStatus({ status, name, id }: DeploymentStatusProps) {
	const config = statusConfig[status];

	return (
		<div className="space-y-2">
			{(name || id) && (
				<div>
					{name && <p className="text-sm font-medium text-slate-600">{name}</p>}
					{id && <p className="text-xs text-slate-500 font-mono">{id}</p>}
				</div>
			)}
			<Badge className={`text-sm py-1 px-3 ${config.color}`}>
				<span className="mr-1">{config.icon}</span>
				{config.label}
			</Badge>
		</div>
	);
}
