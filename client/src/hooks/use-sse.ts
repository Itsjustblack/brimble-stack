import { useCallback, useEffect, useRef, useState } from "react";

type SSE_Status = "IDLE" | "CONNECTING" | "OPEN" | "CLOSED" | "ERROR";

export function useSSE<T>(url: string | undefined) {
	const [data, setData] = useState<T[]>([]);
	const [connectionStatus, setConnectionStatus] = useState<SSE_Status>(
		url ? "CONNECTING" : "IDLE",
	);

	const eventSourceRef = useRef<EventSource | null>(null);

	const close = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
			setConnectionStatus("CLOSED");
			setData([]);
		}
	}, []);

	useEffect(() => {
		if (!url) return;

		// IMPORTANT: close previous connection before opening new one
		close();

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setConnectionStatus("OPEN");
		};

		eventSource.onerror = (error) => {
			console.error("SSE error:", error);
			setConnectionStatus("ERROR");
			close();
		};

		eventSource.onmessage = (event) => {
			try {
				const parsed = JSON.parse(event.data);
				setData((prev) => [...prev, parsed]);
			} catch (e) {
				console.error("Parse error:", e);
			}
		};

		return () => {
			close();
		};
	}, [url, close]);

	return {
		data,
		connectionStatus,
		close,
	};
}
