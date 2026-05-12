import { useEffect, useRef } from "react";
import { useSSE } from "@/hooks/use-sse";

export interface Log {
	level: number;
	time: number;
	pid: number;
	hostname: string;
	slug: string;
	msg: string;
	[key: string]: unknown;
}

const getLogLevelLabel = (level: number): string => {
	const levels: { [key: number]: string } = {
		20: "DEBUG",
		30: "INFO",
		40: "WARN",
		50: "ERROR",
		60: "FATAL",
	};
	return levels[level] || "INFO";
};

const getLogLevelStyles = (level: number): { badge: string; text: string } => {
	const styles: { [key: number]: { badge: string; text: string } } = {
		20: { badge: "bg-blue-100 text-blue-700", text: "text-blue-600" },
		30: { badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-600" },
		40: { badge: "bg-amber-100 text-amber-700", text: "text-amber-600" },
		50: { badge: "bg-red-100 text-red-700", text: "text-red-600" },
		60: {
			badge: "bg-red-100 text-red-900 font-bold",
			text: "text-red-700 font-bold",
		},
	};
	return styles[level] || styles[30];
};

const formatTimestamp = (timeMs: number): string => {
	const date = new Date(timeMs);
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const seconds = String(date.getSeconds()).padStart(2, "0");
	const ms = String(date.getMilliseconds()).padStart(3, "0");
	return `${hours}:${minutes}:${seconds}.${ms}`;
};

const getLogProperties = (log: Log): Record<string, unknown> => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { level, time, pid, hostname, slug, msg, ...rest } = log;
	return rest;
};

interface LiveLogsProps {
	deploymentSlug: string;
}

export default function LiveLogs({ deploymentSlug }: LiveLogsProps) {
	const url = `${import.meta.env.VITE_API_URL}/deployments/${deploymentSlug}/logs`;

	const { data: logs } = useSSE<Log>(url);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [logs]);

	return (
		<div className="flex flex-col h-full gap-3">
			<div className="flex-1 bg-white border border-slate-200 rounded-lg h-full overflow-y-auto flex flex-col shadow-sm">
				<div className="flex-1 overflow-y-auto font-mono text-[11px] leading-6 bg-white">
					{logs.length === 0 ? (
						<div className="p-4 text-center text-xs text-slate-500">
							No logs yet
						</div>
					) : (
						<div>
							{logs.map((log, idx) => {
								const styles = getLogLevelStyles(log.level);
								const properties = getLogProperties(log);

								return (
									<div
										key={idx}
										className="px-4 py-2 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-b-0"
									>
										{/* Main log line */}
										<div className="flex items-center gap-2 flex-wrap">
											<span className="text-slate-500">
												[{formatTimestamp(log.time)}]
											</span>
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${styles.badge}`}
											>
												{getLogLevelLabel(log.level)}
											</span>
											<span className="text-slate-600">({log.pid}):</span>
											<span className={`${styles.text} font-semibold`}>
												{log.msg}
											</span>
										</div>

										{/* Additional properties */}
										{Object.keys(properties).length > 0 && (
											<div className="mt-1 ml-4 space-y-0.5 text-slate-700">
												{Object.entries(properties).map(([key, value]) => (
													<div
														key={key}
														className="text-[10px]"
													>
														<span className="text-slate-600">{key}:</span>{" "}
														<span className="text-slate-900 font-medium">
															{typeof value === "object"
																? JSON.stringify(value)
																: String(value)}
														</span>
													</div>
												))}
											</div>
										)}
									</div>
								);
							})}
							<div ref={bottomRef} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
