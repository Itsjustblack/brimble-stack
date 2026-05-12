import type { Response, Request } from "express";
import { getLogger } from "./logger.js";
import { readStream, subscribeToChannel } from "./redis.js";

type OpenSseStreamOptions = {
	channel?: string;
	streamKey?: string;
	initialEvent?: unknown;
};

export const openSseStream = async (
	req: Request,
	res: Response,
	{ channel, streamKey, initialEvent }: OpenSseStreamOptions,
): Promise<void> => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.setHeader("X-Accel-Buffering", "no");

	res.flushHeaders();

	let closed = false;
	let unsubscribe: (() => Promise<void>) | null = null;

	const send = (record: unknown) => {
		if (!closed && !res.writableEnded) {
			res.write(`data: ${JSON.stringify(record)}\n\n`);
		}
	};

	const heartbeat = setInterval(() => {
		if (!closed && !res.writableEnded) {
			res.write(": heartbeat\n\n");
		}
	}, 30000);

	const cleanup = async () => {
		if (closed) return;
		closed = true;
		clearInterval(heartbeat);

		if (unsubscribe) {
			try {
				await unsubscribe();
			} catch (err) {
				getLogger().error(err, "Failed to unsubscribe");
			}
		}

		if (!res.writableEnded) {
			res.end();
		}
	};

	req.on("close", () => {
		void cleanup();
	});
	res.on("error", (err) => {
		getLogger().warn(err, "SSE response error");
		void cleanup();
	});

	if (initialEvent !== undefined) {
		send(initialEvent);
	}

	if (streamKey) {
		unsubscribe = readStream(streamKey, send);
		if (closed) {
			try {
				await unsubscribe();
			} catch (err) {
				getLogger().error(err, "Failed to stop stream after late close");
			}
		}
	} else if (channel) {
		try {
			unsubscribe = await subscribeToChannel(channel, send);
		} catch (err) {
			getLogger().error(err, "Failed to subscribe to channel");
			await cleanup();
			return;
		}

		// Client may have disconnected during the await — cleanup ran without an
		// unsubscribe handle, so undo the subscription now.
		if (closed) {
			try {
				await unsubscribe();
			} catch (err) {
				getLogger().error(err, "Failed to unsubscribe after late close");
			}
		}
	}
};
