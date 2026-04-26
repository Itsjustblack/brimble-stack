import {
	IconChevronDown,
	IconFilter,
	IconSearch,
	IconSettings,
} from "@tabler/icons-react";
import { useState } from "react";
import "./App.css";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Input } from "./components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";

const mockLogs = [
	{
		id: 1,
		timestamp: "Sep 07 12:47:34",
		service: "Backend",
		replica: "90cb69c4",
		message: "=> Error: No matching routes for GET /favicon.ico text/html.",
	},
	{
		id: 2,
		timestamp: "Sep 07 12:47:34",
		service: "Backend",
		replica: "90cb69c4",
		message: "=> Warning: Responding with 404 Not Found catcher.",
	},
	{
		id: 3,
		timestamp: "Sep 07 12:47:34",
		service: "Backend",
		replica: "90cb69c4",
		message: "=> Response succeeded.",
	},
	{
		id: 4,
		timestamp: "Sep 07 15:54:38",
		service: "Frontend",
		replica: "a8dcef44",
		message:
			'[2023-09-07T22:54:38.433Z] "GET /" "Mozilla/5.0 (compatible; CensysInspect/1.1; +https://abo',
	},
	{
		id: 5,
		timestamp: "Sep 07 15:54:38",
		service: "Frontend",
		replica: "a8dcef44",
		message:
			'[2023-09-07T22:54:38.950Z] "GET /assets/favicon.17e50649.svg" "Mozilla/5.0 (compatible; Cens',
	},
	{
		id: 6,
		timestamp: "Sep 07 15:54:39",
		service: "Frontend",
		replica: "a8dcef44",
		message:
			'[2023-09-07T22:54:39.056Z] "GET /favicon.ico" "Mozilla/5.0 (compatible; CensysInspect/1.1; +',
	},
	{
		id: 7,
		timestamp: "Sep 07 15:54:39",
		service: "Frontend",
		replica: "a8dcef44",
		message:
			'[2023-09-07T22:54:39.057Z] "GET /favicon.ico" Error (404): "Not found"',
	},
	{
		id: 8,
		timestamp: "Sep 07 20:43:44",
		service: "Backend",
		replica: "d7418310",
		message: "GET /:",
	},
	{
		id: 9,
		timestamp: "Sep 07 20:43:44",
		service: "Backend",
		replica: "d7418310",
		message: "=> Matched: GET / (index)",
	},
	{
		id: 10,
		timestamp: "Sep 07 20:43:44",
		service: "Backend",
		replica: "d7418310",
		message: "=> Outcome: Success",
	},
	{
		id: 11,
		timestamp: "Sep 07 20:43:44",
		service: "Backend",
		replica: "d7418310",
		message: "=> Response succeeded.",
	},
];

function App() {
	const [filterText, setFilterText] = useState("");
	const [selectedFilters, setSelectedFilters] = useState({
		timestamp: true,
		deploy: false,
		service: true,
		plugin: false,
		replica: true,
	});
	const [expandedLog, setExpandedLog] = useState<number | null>(null);

	const toggleFilter = (key: string) => {
		setSelectedFilters((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	const getServiceBadgeColor = (service: string) => {
		return service === "Backend"
			? "bg-blue-100 text-blue-900"
			: "bg-purple-100 text-purple-900";
	};
	return (
		<div className="h-screen bg-white text-slate-900 flex flex-col">
			{/* Header */}
			<header className="border-b border-slate-200 px-6 py-4 bg-slate-50">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-4">
						<div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center">
							<span className="text-white font-bold text-sm">∞</span>
						</div>
						<span className="text-slate-400">/</span>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="text-slate-900 hover:text-slate-900 hover:bg-slate-200"
								>
									Monorepo
									<IconChevronDown className="w-4 h-4 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="bg-white border-slate-200">
								<DropdownMenuItem className="text-slate-900">
									Monorepo 1
								</DropdownMenuItem>
								<DropdownMenuItem className="text-slate-900">
									Monorepo 2
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<span className="text-slate-400">/</span>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="text-slate-900 hover:text-slate-900 hover:bg-slate-200"
								>
									production
									<IconChevronDown className="w-4 h-4 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="bg-white border-slate-200">
								<DropdownMenuItem className="text-slate-900">
									production
								</DropdownMenuItem>
								<DropdownMenuItem className="text-slate-900">
									staging
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<nav className="flex items-center gap-8">
						<Button
							variant="ghost"
							className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
						>
							Architecture
						</Button>
						<Button
							variant="ghost"
							className="text-slate-900 hover:text-slate-900 hover:bg-slate-200"
						>
							Observability
						</Button>
					</nav>

					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
						>
							Help
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="hover:bg-slate-200 p-0"
								>
									<Avatar className="w-8 h-8">
										<AvatarImage
											src="https://github.com/shadcn.png"
											alt="@shadcn"
										/>
										<AvatarFallback>CN</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="bg-white border-slate-200">
								<DropdownMenuItem className="text-slate-900">
									Profile
								</DropdownMenuItem>
								<DropdownMenuItem className="text-slate-900">
									Settings
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				{/* Main Content */}
				<main className="flex-1 flex flex-col overflow-hidden">
					{/* Filter Bar */}
					<div className="border-b border-slate-200 px-6 py-4 bg-slate-50">
						<div className="flex items-center gap-3">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										className="border-slate-300 text-slate-900 hover:bg-slate-100 hover:text-slate-900"
									>
										<span className="mr-2 text-sm">⏰</span>
										All Time
										<IconChevronDown className="w-4 h-4 ml-2" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="bg-white border-slate-200">
									<DropdownMenuItem className="text-slate-900">
										All Time
									</DropdownMenuItem>
									<DropdownMenuItem className="text-slate-900">
										Last Hour
									</DropdownMenuItem>
									<DropdownMenuItem className="text-slate-900">
										Last Day
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>

							<div className="flex-1 relative">
								<Input
									placeholder="Filter logs using '', (), AND, OR, -"
									value={filterText}
									onChange={(e) => setFilterText(e.target.value)}
									className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
								/>
							</div>

							<Button
								variant="ghost"
								size="icon"
								className="hover:bg-slate-100 text-slate-700"
							>
								<IconFilter className="w-4 h-4" />
							</Button>

							<Button
								variant="ghost"
								size="icon"
								className="hover:bg-slate-100 text-slate-700"
							>
								<IconSearch className="w-4 h-4" />
							</Button>

							<Button
								variant="ghost"
								size="icon"
								className="hover:bg-slate-100 text-slate-700"
							>
								<IconSettings className="w-4 h-4" />
							</Button>
						</div>
					</div>

					{/* Logs Table */}
					<div className="flex-1 overflow-auto">
						<div className="p-6">
							{/* Table Header */}
							<div className="grid grid-cols-12 gap-4 pb-4 border-b border-slate-200 text-sm font-semibold text-slate-600 sticky top-0 bg-white">
								<div className="col-span-2">Timestamp</div>
								<div className="col-span-2">Service</div>
								<div className="col-span-2">Replica</div>
								<div className="col-span-5">Message</div>
								<div className="col-span-1"></div>
							</div>

							{/* Table Rows */}
							<div className="space-y-0">
								{mockLogs.map((log) => (
									<div key={log.id}>
										<button
											onClick={() =>
												setExpandedLog(expandedLog === log.id ? null : log.id)
											}
											className="w-full grid grid-cols-12 gap-4 py-3 px-0 border-b border-slate-200 hover:bg-slate-50 text-sm text-slate-700 items-center group cursor-pointer transition-colors"
										>
											<div className="col-span-2 font-mono text-xs">
												{log.timestamp}
											</div>
											<div className="col-span-2">
												<Badge
													variant="secondary"
													className={`${getServiceBadgeColor(log.service)}`}
												>
													{log.service}
												</Badge>
											</div>
											<div className="col-span-2 font-mono text-xs text-slate-600">
												{log.replica}
											</div>
											<div className="col-span-5 text-left truncate font-mono text-xs">
												{log.message}
											</div>
											<div className="col-span-1 flex justify-end">
												<IconChevronDown
													className={`w-4 h-4 transition-transform ${expandedLog === log.id ? "rotate-180" : ""}`}
												/>
											</div>
										</button>

										{/* Expanded Content */}
										{expandedLog === log.id && (
											<div className="bg-slate-100 px-6 py-4 border-b border-slate-200 space-y-2">
												<div className="font-mono text-xs text-slate-600">
													<div>
														@service: dafc5234-72a5-4b4c-b806-050486674a3e
													</div>
													<div>
														@deployment: 912e3daa-7a04-43c3-a7fd-f698408d6f91
													</div>
													<div>
														@replica: a8dcef44-1358-495c-b371-7d2cff13e255
													</div>
												</div>
												<Button
													variant="ghost"
													size="sm"
													className="text-purple-600 hover:text-purple-700 hover:bg-slate-200 text-xs mt-2"
												>
													View in Context
												</Button>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				</main>

				{/* Right Sidebar */}
				<aside className="w-64 border-l border-slate-200 bg-slate-50 p-6 overflow-auto">
					<div className="space-y-4">
						{Object.entries(selectedFilters).map(([key, value]) => (
							<div
								key={key}
								className="flex items-center space-x-3"
							>
								<Checkbox
									id={key}
									checked={value}
									onCheckedChange={() => toggleFilter(key)}
									className="border-slate-400"
								/>
								<label
									htmlFor={key}
									className="text-sm font-medium text-slate-700 capitalize cursor-pointer"
								>
									{key === "deploy"
										? "Deploy"
										: key.charAt(0).toUpperCase() + key.slice(1)}
								</label>
							</div>
						))}
					</div>
				</aside>
			</div>
		</div>
	);
}

export default App;
