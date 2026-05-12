import { Badge } from "@/components/ui/badge";

export type Deploymentstatus =
	| "pending"
	| "cloning"
	| "building"
	| "ready"
	| "deploying"
	| "live"
	| "failed"
	| "stopped"
	| "cancelled";

export interface Deployment {
	id: string;
	slug: string;
	name?: string;
	repoUrl: string;
	status: Deploymentstatus;
	imageTag?: string;
	liveUrl?: string;
	containerId?: string;
	port?: number;
	createdAt: string;
	updatedAt: string;
}

const statusColors: Record<Deploymentstatus, string> = {
	pending: "bg-yellow-100 text-yellow-900",
	cloning: "bg-blue-100 text-blue-900",
	building: "bg-orange-100 text-orange-900",
	ready: "bg-teal-100 text-teal-900",
	deploying: "bg-blue-100 text-blue-900",
	live: "bg-green-100 text-green-900",
	failed: "bg-red-100 text-red-900",
	stopped: "bg-slate-100 text-slate-900",
	cancelled: "bg-rose-100 text-rose-900",
};

interface DeploymentsListProps {
	deployments: Deployment[];
	selectedId?: string;
	onSelect: (deployment: Deployment) => void;
}

export function DeploymentsList({
	deployments,
	selectedId,
	onSelect,
}: DeploymentsListProps) {
	return (
		<div className="mt-8">
			<h3 className="text-lg font-semibold text-slate-900 mb-4">
				Recent Deployments
			</h3>
			<div className="space-y-2 max-h-96 overflow-auto">
				{deployments.length === 0 ? (
					<p className="text-sm text-slate-500 py-4">No deployments yet</p>
				) : (
					deployments.map((deployment) => (
						<button
							key={deployment.id}
							onClick={() => onSelect(deployment)}
							className={`w-full text-left p-3 rounded-lg border transition-colors ${
								selectedId === deployment.id
									? "border-blue-300 bg-blue-50"
									: "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
							}`}
						>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<p className="font-medium text-slate-900 truncate">
										{deployment.name}
									</p>
									<p className="text-xs text-slate-600 truncate">
										{deployment.repoUrl}
									</p>
								</div>
								<Badge
									className={`whitespace-nowrap ${statusColors[deployment.status]}`}
								>
									{deployment.status}
								</Badge>
							</div>
							<p className="text-xs text-slate-500 mt-2">
								{deployment.createdAt}
							</p>
						</button>
					))
				)}
			</div>
		</div>
	);
}
