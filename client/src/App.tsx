import { useState } from "react";
import DeploymentControls from "./components/deployment-controls";
import { DeploymentForm } from "./components/deployment-form";
import { DeploymentsList } from "./components/deployment-list";
import LiveLogs from "./components/live-logs";
import { useDeployments } from "./hooks/use-deployments";

export default function App() {
	const { deployments } = useDeployments();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const selectedDeployment =
		deployments.find((d) => d.id === selectedId) ?? null;

	return (
		<div className="h-screen bg-white flex flex-col">
			{/* Header */}
			<div className="border-b border-slate-200 px-8 py-4 bg-white">
				<h1 className="text-2xl font-bold text-slate-900">Brimble Stack</h1>
			</div>

			{/* Main Container with Fixed Left Sidebar */}
			<div className="flex gap-8 p-8 flex-1 h-[calc(100%-80px)]">
				{/* Left Section - Fixed Width */}
				<div className="w-96 shrink-0 max-h-screen overflow-y-auto space-y-8">
					<DeploymentForm />
					<DeploymentsList
						deployments={deployments}
						onSelect={(d) => setSelectedId(d.id)}
						selectedId={selectedDeployment?.id}
					/>
				</div>

				{/* Right Section - Flex and Take Remaining Space */}
				<div className="flex-1 flex flex-col gap-6">
					{selectedDeployment ? (
						<>
							<DeploymentControls
								deployment={selectedDeployment}
								onDelete={() => setSelectedId(null)}
							/>

							{/* Logs Section - Takes Remaining Space */}
							<div className="flex-1 min-h-0 overflow-hidden">
								<LiveLogs deploymentSlug={selectedDeployment.slug} />
							</div>
						</>
					) : (
						<div className="flex items-center justify-center flex-1 text-center">
							<p className="text-slate-600">
								Select a deployment to view details
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
