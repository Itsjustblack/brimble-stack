import { logger } from "../lib/logger.js";

const CADDY_ADMIN_URL = "http://caddy:2019";

const CADDY_HEADERS = {
	Origin: "http://caddy:2019",
};

type RouteConfig = {
	domain: string;
	upstreamHost: string;
	upstreamPort: number;
};

type CaddyMatcher = {
	host?: string[];
};

type CaddyHandler = {
	handler: string;
	upstreams?: { dial: string }[];
};

type CaddyRoute = {
	match?: CaddyMatcher[];
	handle?: CaddyHandler[];
};

type CaddyServer = {
	listen: string[];
	routes: CaddyRoute[];
};

type CaddyConfig = {
	apps?: {
		http?: {
			servers: Record<string, CaddyServer>;
		};
	};
};

async function getCurrentConfig(): Promise<CaddyConfig> {
	const res = await fetch(`${CADDY_ADMIN_URL}/config/`, {
		headers: CADDY_HEADERS,
	});

	if (!res.ok) {
		logger.error({
			status: res.status,
			statusText: res.statusText,
		}, "Failed to fetch Caddy config");
		throw new Error(`Failed to fetch config: ${res.statusText}`);
	}

	return (await res.json()) as CaddyConfig;
}

async function loadConfig(config: CaddyConfig): Promise<void> {
	const res = await fetch(`${CADDY_ADMIN_URL}/load`, {
		method: "POST",
		headers: {
			...CADDY_HEADERS,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(config),
	});

	if (!res.ok) {
		const errorText = await res.text();

		logger.error({
			status: res.status,
			error: errorText,
		}, "Failed to load Caddy config");

		throw new Error(`Failed to load config: ${res.status} ${errorText}`);
	}
}

function ensureServer(config: CaddyConfig): CaddyServer {
	config.apps ??= {};
	config.apps.http ??= {
		servers: {
			srv0: {
				listen: [":80", ":443"],
				routes: [],
			},
		},
	};

	const server = config.apps.http.servers.srv0;

	if (!server) {
		const fresh: CaddyServer = {
			listen: [":80", ":443"],
			routes: [],
		};

		config.apps.http.servers.srv0 = fresh;
		return fresh;
	}

	server.routes ??= [];
	return server;
}

function routeMatchesDomain(route: CaddyRoute, domain: string): boolean {
	return route.match?.some((m) => m.host?.includes(domain)) ?? false;
}

export async function addRoute({
	domain,
	upstreamHost,
	upstreamPort,
}: RouteConfig): Promise<void> {
	const upstream = `${upstreamHost}:${upstreamPort}`;

	logger.info({ domain, upstream }, "Adding reverse proxy route");

	try {
		const config = await getCurrentConfig();
		const server = ensureServer(config);

		if (server.routes.some((route) => routeMatchesDomain(route, domain))) {
			logger.info({ domain, upstream }, "Route already exists, skipping");
			return;
		}

		server.routes.push({
			match: [{ host: [domain] }],
			handle: [
				{
					handler: "reverse_proxy",
					upstreams: [{ dial: upstream }],
				},
			],
		});

		await loadConfig(config);

		logger.info({ domain, upstream }, "Route added");
	} catch (error) {
		logger.error({
			domain,
			upstream,
			error: error instanceof Error ? error.message : String(error),
		}, "Failed to add route");

		throw error;
	}
}

export async function removeRoute(domain: string): Promise<void> {
	logger.info({ domain }, "Removing reverse proxy route");

	try {
		const config = await getCurrentConfig();
		const server = config.apps?.http?.servers.srv0;

		if (!server?.routes?.length) {
			logger.info({ domain }, "No routes configured, nothing to remove");
			return;
		}

		const before = server.routes.length;

		server.routes = server.routes.filter(
			(route) => !routeMatchesDomain(route, domain),
		);

		const removed = before - server.routes.length;

		if (removed === 0) {
			logger.info({ domain }, "No matching route found");
			return;
		}

		await loadConfig(config);

		logger.info({ domain, removed }, "Route removed");
	} catch (error) {
		logger.error({
			domain,
			error: error instanceof Error ? error.message : String(error),
		}, "Failed to remove route");

		throw error;
	}
}
