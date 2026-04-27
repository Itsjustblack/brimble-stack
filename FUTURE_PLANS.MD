> **Note to Claude:** Ignore this file when thinking, building, or working.

---

# Project Overview

## What We're Building

A mini-PaaS: paste a git URL, the system clones it, builds it into a container image with railpack, runs that container, and gives you back a live URL like `http://deploy-1a2b3c4d.localhost:8080`. The whole build is streamed live to your browser as it happens.

---

## Services

All services run on a single Docker network: `brimble-network`.

| Service               | What it does                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **postgres**          | Stores deployments + every log line. The source of truth for "what was deployed" and"what was logged".                                                        |
| **redis**             | Two jobs: BullMQ build queue, and pub/sub channel for live log streaming between worker → api.                                                                 |
| **buildkitd**         | The image builder. Worker tells it "build this repo", it produces a `.tar` image.                                                                              |
| **api**               | Express server. Serves the REST API the frontend uses (create/list/delete deployments) and the SSE endpoint that streams logs to the browser.                  |
| **worker**            | Headless process. Picks build jobs off the queue, runs the actual pipeline (clone → build → run container → register Caddy route).                             |
| **caddy**             | Reverse proxy. One public port (`:8080`). Routes `<deploy>.localhost` → the right deployment container. Routes are added/removed at runtime via its admin API. |
| **deployment-\<id\>** | The user's app, started by the worker. Each one is a separate container on `brimble-network` so Caddy can reach it by name.                                    |

---

## Communication Architecture

```
        browser
           │
           │  POST /api/deployments        SSE /api/deployments/:id/logs/stream
           ▼
         [api] ───────────────────────────────────────┐
           │                                          │
           │ enqueue job                  subscribe   │
           ▼                              to logs     │
        [redis] ◄──── pub: log lines ─── [worker] ────┤ pub/sub
           │                                │         │
           │ pulls job                      │ writes  │
           ▼                                ▼         │
        [worker] ──── docker build ──► [buildkitd]  [postgres]
           │
           │ docker run
           ▼
       deployment-<id>  ◄── reverse proxy ──  [caddy]  ◄── http://<id>.localhost:8080
```

**Key rules:**

- **Frontend ↔ api:** Plain HTTP (REST) and SSE for the live log stream.
- **api → worker:** Never direct. They talk through the Redis queue (jobs) and Redis pub/sub (logs).
- **Worker → buildkitd:** TCP — asks it to build an image and writes the result to a shared volume.
- **Worker → deployment containers:** Uses the Docker socket to start them on `brimble-network`.
- **Worker → caddy:** HTTP call to Caddy's admin API to register a new route after a container starts.
- **Caddy → deployment containers:** Reverse proxies by container name on `brimble-network`.
- **Everyone → postgres:** api reads, worker writes logs, both write deployment status.

---

## Build Process

> **Current implementation status (as of 2026-04-26):** All stages below are fully operational end-to-end — clone → prepare → build → run → proxy are all working.

1. **User submits a git URL.** The API creates a `Deployment` row (status: `pending`) and pushes a job onto the Redis queue.
2. **Worker picks up the job.** The BullMQ worker in `server/src/worker.ts` dequeues the job and runs each pipeline stage in sequence, logging each step to the terminal.
3. **Clone.** Worker `git clone --depth=1`s the repo into `/app/repos/<deploymentId>` (`server/src/pipeline/git-repo.ts` → `cloneGitRepo`). Status → `cloning`.
4. **Prepare.** Worker runs `railpack prepare` on the cloned directory, detecting the language/framework and producing `railpack-plan.json` and `railpack-info.json` (`server/src/pipeline/railpack.ts` → `runRailpackPrepare`). Status → `building`.
5. **Build.** Worker runs `docker buildx build --load`, passing `BUILDKIT_SYNTAX=ghcr.io/railwayapp/railpack-frontend:latest` as a build arg and the Railpack-generated plan as the Dockerfile (`server/src/pipeline/railpack.ts` → `runRailpackBuild`). BuildKit executes the plan and loads the final image directly into the host daemon's image store — no intermediate tar file and no separate buildkitd service. Status → `deploying`.
6. **Run.** Worker starts the container as `deployment-<id>` on `mini-paas-network` via `docker run -d`, without publishing any host ports (`server/src/pipeline/deploy.ts` → `startContainer`).
7. **Route.** Worker calls Caddy's admin API to register (or idempotently update) the route `deploy-<slug>.localhost` → `reverse_proxy deployment-<id>:3000` (`server/src/pipeline/proxy.ts` → `addRoute`). Status → `live`. `liveUrl` is saved on the deployment row.
8. **Live.** Browser opens `http://deploy-<slug>.localhost:8080` → Caddy matches the host header → forwards to the container → app responds.

---

## How Logs Reach the Browser in Real Time

Every line emitted by `git`, `railpack`, `buildctl`, and `docker` flows through the same logger. That logger writes to postgres (for replay), publishes to a Redis channel `deploy:<id>:logs`, and prints to the worker's stdout.

The api is subscribed to that Redis channel. When a browser opens the SSE endpoint for a deployment, the api backfills past lines from postgres, then forwards every new published line as it arrives. The user sees the build live, and reloading the page replays it from the start.

---

## Architectural Decisions

### Docker Image Storage: Host Machine vs Docker Compose Registry

**Decision:** Store built Docker images in the host machine's local Docker daemon rather than running a dedicated registry container in Docker Compose.

**Reasons:**

1. **No extra service overhead** — A registry container adds memory, storage, and network config complexity to the Compose stack; the host daemon already manages images natively with zero setup.
2. **Simpler image lifecycle** — Images built via `docker load` are immediately available to `docker run` on the host without push/pull round-trips or registry authentication.
3. **Persistence across stack restarts** — Host daemon images survive `docker compose down`; a Compose-managed registry loses its data unless a volume is explicitly configured and preserved.

### Docker Load: Separated from Build Step

> **Superseded.** See "Docker Load: No Longer a Separate Step" in the Decisions Revised section below. `docker buildx build --load` performs build-and-load in one invocation; there is no intermediate stream or separate `loadDockerImage` function in the current implementation.

~~`loadDockerImage` is a standalone exported function in `railpack-build.ts` that accepts a `Readable` image stream and pipes it into `docker load`. `runRailpackBuild` handles only the buildctl invocation; it passes its stdout to `loadDockerImage` and awaits both concurrently via `Promise.all`. Each function owns its own logging and error handling.~~

### Docker CLI in the Worker Image: Static Binary, No Daemon

**Decision:** The `runtime-worker` stage installs the Docker CLI by pulling the static binary tarball from `download.docker.com/linux/static/stable/` and extracting just the `docker` executable into `/usr/local/bin`. No `dockerd` is installed — the worker talks to the host's Docker daemon over the mounted socket.

**Reasons:**

1. **CLI-only is all the pipeline needs** — `docker load` and `docker run` in the worker pipeline are client calls; the daemon lives on the host and is reached via the bind-mounted `/var/run/docker.sock`. Shipping `dockerd` inside the worker would add ~100MB and a service we never start.
2. **Matches the existing install pattern** — Railpack and BuildKit are already pulled the same way (curl a release tarball, extract one binary). Adding Docker via apt + Docker's APT repo would mean a second package-source mechanism for one binary.
3. **Pinned, reproducible version** — `DOCKER_VERSION` is a build arg, so the CLI version is explicit in the Dockerfile rather than drifting with whatever the apt repo currently serves.

### Release Strategy: Stop-then-Start (Recreate)

**Decision:** When a new deployment of an existing app is ready, the previous container is stopped and removed before the new one is started. No blue/green, no rolling.

**Reasons:**

1. **Simplest viable lifecycle** — Single replica per app, single container name, single Caddy upstream. Nothing to reconcile, nothing to atomically swap.
2. **Acceptable downtime for v1** — The cutover window is bounded by stop grace period plus container start; on the order of seconds. Early users do not have a strict SLA to defend.
3. **Defers correctness work that only matters at higher scale** — Health-check gating, traffic draining, and atomic upstream swaps are real engineering. Build them when there are multiple replicas to coordinate or an SLA to enforce.

### App Identity: Stable Slug, Not Deployment ID

**Decision:** The running container's name and its Caddy route are keyed on a stable slug derived from the repo, not on the deployment ID. Deployment ID remains the unit of build history; the slug is the unit of "what is currently running."

**Reasons:**

1. **Stop-then-start becomes idempotent** — Same name in, same name out. The Caddy route, addressed by a slug-derived ID, is updated in place rather than added per deployment and cleaned up later.
2. **Eliminates port allocation** — Containers don't publish to the host; they live on the shared internal network. Every container can listen on the same internal port without collision, because the slug is the only address that matters.
3. **Matches how users think about apps** — A user redeploying their repo expects "their app" to update, not for a new URL to appear each time.

### Edge Ports: Only Caddy Publishes to the Host

**Decision:** Deployment containers do not bind ports on the host. Only Caddy publishes the public ports. Caddy reaches deployment containers by container name on the shared Docker network.

**Reasons:**

1. **No port allocation logic** — Without host bindings, container ports are namespace-local and cannot collide.
2. **Single ingress surface** — One service answers public traffic, terminates TLS, and logs HTTP requests. Easier to reason about, easier to harden.
3. **Deployments are invisible off-network** — They aren't reachable except through the proxy, which is the security posture we want anyway.

### Caddy Admin API: Explicit Origins for Cross-Container Access

**Decision:** The Caddyfile configures the admin endpoint with an explicit `origins` block listing `caddy:2019`, `localhost:2019`, and `127.0.0.1:2019`.

**Reasons:**

Binding to `0.0.0.0:2019` makes Caddy *listen* on all interfaces but does not grant trust to requests from arbitrary hostnames. Caddy's admin API enforces an origin check: it compares the request's `Host` header (or `Origin` header if present) against a list of allowed origins. The default list contains only loopback addresses (`localhost:2019`, `127.0.0.1:2019`, `[::1]:2019`). When the worker container fetches `http://caddy:2019/config/`, the `Host` header is `caddy:2019` — not a loopback address — so Caddy rejects it with `403 Forbidden`. Adding `caddy:2019` to `origins` explicitly permits the worker's requests while keeping the admin API unreachable from outside the Docker network.

---

### Caddy Routes: Idempotent Updates via Stable IDs

**Decision:** Each Caddy route is created with a deterministic `@id` derived from the app slug, and subsequent deploys update it in place rather than creating new routes and cleaning up old ones.

**Reasons:**

1. **No reconciliation state** — The current Caddy config is always exactly the routes the system wants. There is no garbage to collect.
2. **Simple failure modes** — Either the route update succeeds and the new container takes traffic, or it fails loudly. No partial state where two routes for the same app coexist.
3. **Cheap to inspect** — Operators read Caddy's config and see one route per running app, no archaeology.

---

## Decisions Revised

The following decisions documented above have been superseded by the current implementation in `server/src/pipeline/railpack.ts`, `server/src/pipeline/deploy.ts`, and `docker-compose.yml`.

### Image Build: `docker buildx` with Railpack Frontend, Not Standalone `buildkitd`

**Previous decision:** A dedicated `buildkitd` service in Docker Compose received TCP build requests from the worker; it produced an OCI image tar on a shared volume which the worker then `docker load`ed. This is reflected in the diagram and the "Build Process" steps 5–6 above.

**New decision:** The worker invokes `docker buildx build` against the host Docker daemon over the bind-mounted `/var/run/docker.sock`, passing `BUILDKIT_SYNTAX=ghcr.io/railwayapp/railpack-frontend:latest` as a build arg and the Railpack-generated plan (`.railpack/railpack-plan.json`) as the Dockerfile (`-f`). The `--load` flag streams the final image directly into the host daemon's image store. There is no `buildkitd` service in `docker-compose.yml`.

**Reasons for the change:**

1. **One BuildKit, not two** — The host Docker daemon already embeds BuildKit. Running a separate `buildkitd` service duplicates the builder, doubles cache footprint, and adds a TCP hop the worker must configure and reach.
2. **No tar handoff** — Removing the intermediate `.tar` eliminates the shared volume between worker and buildkitd, the disk I/O of writing then reading the tar, and the `docker load` step.
3. **Frontend pinning is per-build, not per-service** — The Railpack frontend image is selected via `--build-arg BUILDKIT_SYNTAX=...`, so upgrading or pinning the frontend is a code change in the worker rather than a Compose change.

### Docker Load: No Longer a Separate Step

**Previous decision:** `loadDockerImage` was a standalone exported function that piped a `Readable` image stream into `docker load`, run concurrently with `buildctl` via `Promise.all`. Each function owned its own logging and error handling.

**New decision:** Removed. `docker buildx build --load` performs build-and-load in one invocation; there is no intermediate stream the worker needs to manage. The previous `loadDockerImage` implementation is preserved as commented-out code in [server/src/pipeline/deploy.ts](server/src/pipeline/deploy.ts) for reference and will be deleted once the buildx path is proven.

**Reasons for the change:**

1. **No stream to manage** — Without a tar artifact, there is nothing for the worker to pipe; `--load` is the buildx-native path.
2. **One fewer failure mode** — A separated load step could fail after a successful build, leaving a tar that needed cleanup. Atomic build-and-load removes that case.

### Shared Docker Network: `mini-paas-network`

**Previous decision:** The shared Docker network was named `brimble-network`. Caddy, the worker, and deployment containers all attached to it.

**New decision:** Renamed to `mini-paas-network` to match the naming convention already used for the other services (`mini-paas-db`, `mini-paas-redis`, `mini-paas-api`, `mini-paas-worker`, `mini-paas-caddy`). The network is declared in [docker-compose.yml](docker-compose.yml) and referenced as the default network for new deployment containers in [server/src/pipeline/deploy.ts](server/src/pipeline/deploy.ts).

### Worker → Docker: Host Socket, Not buildkitd TCP

**Previous decision:** The worker reached the builder over TCP to `buildkitd` and used the Docker socket only for `docker load` / `docker run`.

**New decision:** The worker uses a single channel — the bind-mounted host Docker socket — for builds (`docker buildx build`), image loading (now subsumed into `--load`), and container lifecycle (`docker run`). `docker-compose.yml` mounts `/var/run/docker.sock:/var/run/docker.sock` into the worker.

**Reasons for the change:**

1. **One client, one auth surface** — All build and run calls go through the same socket; there is no separate buildkitd endpoint to discover, secure, or health-check.
2. **Consistent with the static-CLI decision** — The worker already ships only the Docker CLI (no `dockerd`), so routing every Docker operation through the host daemon was the natural extension.

### Live URL: Deployment ID Subdomain on Caddy's Standard Ports

**Previous decision:** The public URL pattern was `http://deploy-<slug>.localhost:8080`, with Caddy publishing the system on a single non-standard port (`:8080`) and the subdomain derived from a stable repo slug.

**New decision:** The live URL is `http://<deploymentId>.localhost`, where `<deploymentId>` is the full deployment UUID. Caddy publishes the standard HTTP/HTTPS ports (`80:80`, `443:443`, `443:443/udp`) per [docker-compose.yml](docker-compose.yml). The worker computes `domain = "${deploymentId}.localhost"` directly in [server/src/worker.ts:62](server/src/worker.ts#L62) and passes it to `startContainer`.

**Reasons for the change:**

1. **Standard ports remove user-visible surface** — Hitting `http://<id>.localhost` is shorter than `:8080` and matches the way browsers handle bare-host URLs.
2. **Slug work was deferred** — Repo-derived slug generation is not yet implemented (see Future Plans #10), so the deployment UUID is used as a unique, collision-free identifier instead.

**Tradeoff:** Because the subdomain is per-deployment rather than per-app, redeploying the same repo today produces a *new* URL each time. The "App Identity: Stable Slug" decision still stands as the target end-state; it just isn't implemented yet (see Future Plans #23).

### Caddy Route Updates: Full Config Replace, Not Per-Route `@id` PATCH

**Previous decision:** Each Caddy route was created with a deterministic `@id` derived from the app slug, and subsequent deploys updated that route in place via Caddy's `@id`-addressed admin API.

**New decision:** [server/src/pipeline/proxy.ts](server/src/pipeline/proxy.ts) fetches the entire current config (`GET /config/`), mutates the in-memory `apps.http.servers.srv0.routes` array, and replaces the whole config via `POST /load`. Routes are matched by host string in [proxy.ts:107](server/src/pipeline/proxy.ts#L107), not by `@id`. `addRoute` is idempotent (skips if a route with the same host already exists), and `removeRoute` filters by host. The Caddyfile in [conf/Caddyfile](conf/Caddyfile) only configures the admin endpoint origins; the route table is built entirely at runtime.

**Reasons for the change:**

1. **Simpler API surface** — One read, one write, no per-route ID juggling.
2. **Atomic from Caddy's perspective** — A single `POST /load` swaps the full config in one operation.

**Tradeoff:** The GET-mutate-POST flow has a TOCTOU window. With multiple workers running in parallel, a second `addRoute` could overwrite a route added by the first between its read and its write. Acceptable for v1's single-worker pipeline; revisit if Future Plans #22 (parallel workers) lands. The "stable `@id`" decision remains the target end-state — see Future Plans #25.

### SSE Endpoint: `/logs` and Live-Only (No Postgres Backfill Yet)

**Previous decision:** The SSE path was `SSE /api/deployments/:id/logs/stream` (per the "Communication Architecture" diagram), and the api was supposed to backfill past lines from postgres before forwarding new ones from Redis pub/sub (per "How Logs Reach the Browser in Real Time").

**New decision:**

- **Route is `GET /api/deployments/:id/logs`** — no `/stream` suffix ([server/src/modules/deployment/routes.ts:15](server/src/modules/deployment/routes.ts#L15)).
- **No postgres backfill.** The handler at [server/src/modules/deployment/deployment.controller.ts:86](server/src/modules/deployment/deployment.controller.ts#L86) sends an immediate `{type: "connected"}` event and then forwards live Redis pub/sub records only. The `Log` Prisma model exists in [server/prisma/schema.prisma](server/prisma/schema.prisma) but no code writes to it; replay-on-reload is therefore not yet possible. This is still tracked as Future Plan #7.
- **Subscription pooling.** [server/src/lib/redis.ts:35](server/src/lib/redis.ts#L35) (`subscribeToDeploymentLogs`) maintains a per-channel `Set<listener>`; multiple SSE clients on the same deployment share one Redis `SUBSCRIBE`, and the channel is unsubscribed when the last listener disconnects. Returned `unsubscribe()` is awaited by the controller in [deployment.controller.ts:122](server/src/modules/deployment/deployment.controller.ts#L122) on `response.on("close")`.
- **15-second keepalive** comment frames are written to the response to keep the connection open through intermediaries.

**Reasons for the change:**

1. **Cheaper to ship a live-only stream first** — Postgres persistence is a separate concern; gating SSE on it would have blocked the live-log feature.
2. **Pooling avoids N Redis subscriptions per deployment** — Many viewers on one deployment cost one channel subscription, not N.

### DeploymentStatus Enum: Additional States in Schema

**Previous decision:** The "Build Process" walkthrough enumerated `pending → cloning → building → deploying → live` plus `failed`.

**New decision:** [server/prisma/schema.prisma](server/prisma/schema.prisma) now defines `DeploymentStatus` as `pending | cloning | building | ready | deploying | live | running | failed | stopped`. The worker's happy path today is `pending → cloning → building → ready → live` ([server/src/worker.ts](server/src/worker.ts)) — `ready` marks "image built, container not yet started"; `deploying`, `running`, and `stopped` are reserved in the enum but not currently written by the pipeline. See Future Plans #27 for reconciliation.

---

## v1 Scope: Deliberately Excluded

The following are recognized as desirable but explicitly out of scope for v1. They are listed here so the omissions are visibly choices, not oversights. Each maps to an entry in Future Plans.

- **Autoscale and replicas** — Single replica per app. Static, manual.
- **Zero-downtime release strategy** — Blue/green and rolling deploys are deferred. Stop-then-start downtime is accepted.
- **Custom domains** — Only the system's own subdomain pattern is supported. User-attached domains and per-domain cert provisioning are deferred.
- **Env-var and secrets UI** — No first-class management of per-deployment configuration. Containers run with whatever the worker injects.
- **Build cache** — BuildKit cache mounts and per-project dependency caches are deferred. Every build pays full cost.
- **Multi-host scheduling** — All deployments run on the same Docker host. The host is a known single point of failure. Multi-host placement is deferred until horizontal scale or HA is a real requirement.
- **Per-deployment resource limits** — No CPU/memory caps. A misbehaving deployment can starve its neighbors.
- **User-facing metrics** — Logs stream live; CPU / memory / RPS dashboards are not surfaced.
- **Health checks and crashloop policy** — Containers are started and assumed to come up. No readiness probe gates traffic; no backoff stops the system from re-running a broken image on every redeploy.

---

## Pipeline Implementation Status

End-to-end deployment pipeline confirmed working as of 2026-04-26.

| Stage | File | Entry Point | Status |
| ----- | ---- | ----------- | ------ |
| **Clone** | `server/src/pipeline/git-repo.ts` | `cloneGitRepo()` | Done |
| **Prepare** | `server/src/pipeline/railpack.ts` | `runRailpackPrepare()` | Done |
| **Build** | `server/src/pipeline/railpack.ts` | `runRailpackBuild()` | Done |
| **Run** | `server/src/pipeline/deploy.ts` | `startContainer()` | Done |
| **Proxy** | `server/src/pipeline/proxy.ts` | `addRoute()` | Done |

Worker orchestration: `server/src/worker.ts` — BullMQ consumer that runs all stages in sequence.

Services backing the pipeline:

| Service | Container | Role |
| ------- | --------- | ---- |
| postgres | `mini-paas-db` | Stores deployment records and logs |
| redis | `mini-paas-redis` | BullMQ job queue |
| api | `mini-paas-api` | REST API + deployment creation |
| worker | `mini-paas-worker` | Runs the build pipeline |
| caddy | `mini-paas-caddy` | Reverse proxy; routes updated at runtime via admin API |

---

## Future Plans

| #   | Task                                                                                                                 | Status                                             |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Add a registry to store built images                                                                                 | Done — using local Docker registry on host machine |
| 2   | Unique key for deployments: `(deployment_id + commit_hash)`                                                          | Done                                               |
| 3   | Detect GitHub, Atlassian & GitLab URLs → fetch their tar files → store in DB or S3 → fetch from worker at build time | Pending                                            |
| 4   | For unrecognized URLs: `git clone` → compress to tar → store in DB or S3                                             | Pending                                            |
| 5   | Add GitHub Actions CI                                                                                                | Pending                                            |
| 6   | Separate worker & api services                                                                                       | Done — `mini-paas-api` and `mini-paas-worker` are separate Compose services with distinct Dockerfile targets (`runtime-api` / `runtime-worker`) |
| 7   | Persist logs in PostgreSQL                                                                                           | Pending                                            |
| 8   | Audit Homebrew for installed packages no longer in use                                                               | Pending                                            |
| 9   | Separate build and deploy flows                                                                                      | Done — `railpack.ts` owns prepare + build; `deploy.ts` owns container start + Caddy route; `git-repo.ts` owns clone |
| 10  | When created, add the project slug of the repo to the deployment object, need it for the image tag                   | Pending                                            |
| 11  | Add Build Cache for buildkit to ensure it builds faster                                                              | Pending                                            |
| 12  | Zero-downtime release strategy (blue/green or rolling) once apps support multiple replicas                           | Pending                                            |
| 13  | Per-deployment CPU and memory limits                                                                                 | Pending                                            |
| 14  | Custom domain support with automatic cert provisioning                                                               | Pending                                            |
| 15  | Env-var and secrets management UI                                                                                    | Pending                                            |
| 16  | Health checks and readiness gating before traffic cutover                                                            | Pending                                            |
| 17  | Crashloop backoff so broken images don't restart endlessly                                                           | Pending                                            |
| 18  | Multi-host worker pool with placement scheduler (removes single-host SPOF)                                           | Pending                                            |
| 19  | Per-deployment metrics surface (CPU / mem / RPS) for the user                                                        | Pending                                            |
| 20  | Move worker from Docker CLI to Docker SDK for Node (dockerode)                                                       | Pending                                            |
| 21  | Add health checks to Compose services and gate `depends_on` on their healthy status before dependents start          | Pending                                            |
| 22  | Enable running workers in parallel so multiple builds can happen at the same time                                    | Pending                                            |
| 23  | Implement repo-derived stable slug for container name + Caddy host (target end-state of "App Identity: Stable Slug") — today the full deployment UUID is used, so redeploys land on a new URL | Pending                                            |
| 24  | Implement stop-then-start lifecycle on redeploy (target end-state of "Release Strategy: Stop-then-Start") — currently the worker only `docker run`s; the previous container is not stopped/removed, so a redeploy of the same repo will collide on container name | Pending                                            |
| 25  | Move Caddy route updates to deterministic `@id`-addressed PATCH (target end-state of "Caddy Routes: Idempotent Updates via Stable IDs") instead of full-config GET/POST `/load` | Pending                                            |
| 26  | Add Postgres backfill on SSE connect — write each published log line to the `Log` table in the worker, then have the SSE handler page through past rows before forwarding live Redis records | Pending                                            |
| 27  | Reconcile `DeploymentStatus` usage with schema — `deploying`, `running`, and `stopped` are declared but never written by the worker today; either wire them into the pipeline or trim the enum | Pending                                            |
| 28  | Container teardown on `DELETE /api/deployments/:id` — `deleteDeployment` removes the DB row but does not stop the container or remove the Caddy route (`removeRoute` exists in `proxy.ts` but is unused) | Pending                                            |
| 29  | Fully decouple worker from api — today `server/src/worker.ts` imports `updateDeployment`/`updateDeploymentStatus` directly from the api's deployment service and writes to Postgres itself. Replace with an async channel (Redis pub/sub event like `deploy:<id>:status`, or a dedicated BullMQ status queue) so the worker only emits events and the api owns all DB writes via the deployment service | Pending                                            |
