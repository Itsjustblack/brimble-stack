# Troubleshooting

A log of hard-to-diagnose issues and their fixes.

---

## 1. Worker: `railpack prepare` fails with "no such file or directory" on `/var/lib/railpack/tmp`

**Error:**

```
✖ Failed to ensure mise is installed: failed to download and install:
  failed to create temp directory: stat /var/lib/railpack/tmp: no such file or directory
```

**Cause:**

The `worker` service in `docker-compose.yml` mounted a named volume at `/var/lib/railpack`:

```yaml
volumes:
  - railpack_state:/var/lib/railpack
```

That named volume was empty, and mounting it **shadowed** the `tmp/`, `cache/`, `mise/…` folders the Dockerfile had created at build time (see `mkdir -p` in `server/Dockerfile`). When railpack looked inside `/var/lib/railpack`, it saw the empty volume instead of the image's folders, so `stat` on `tmp/` failed.

The Dockerfile's `CMD` tries to `mkdir -p` those folders at container start, but that only runs when the container is launched via the default CMD — not reliable enough.

**Fix:**

Remove the volume mount entirely so `/var/lib/railpack` comes straight from the image layer (where the folders already exist).

Two deletions in `docker-compose.yml`:

1. In the `worker` service's `volumes:` block, remove:

   ```yaml
   - railpack_state:/var/lib/railpack
   ```

2. In the top-level `volumes:` list, remove:
   ```yaml
   railpack_state:
   ```

Then clear the stale volume and rebuild:

```bash
docker compose down
docker volume rm brimble-task_railpack_state
docker compose up -d --build worker
```

**Tradeoff:**

The volume was meant to persist mise-downloaded toolchains between restarts. Without it, railpack re-downloads them on the first build after each restart (~10–30s cost). Worth it for reliability. If the cost matters later, mount only `/var/lib/railpack/mise/data` instead of the whole state dir — that keeps the toolchain cache while leaving `tmp/` and `cache/` from the image.

---

## 2. Worker: Buildkit build fails immediately — `buildctl` can't reach the daemon

**Error:**

```
Build job failed {
  error: 'Buildkit build failed.',
  stack: 'AppError: Buildkit build failed.
      at internalError (.../errors.ts:63:2)
      at runCommand (.../utils.ts:33:10)
      at async runRailpackBuild (.../railpack-build.ts:73:2)'
}
```

**Cause:**

`buildctl` was invoked in `server/src/pipeline/railpack-build.ts` without an `--addr` flag:

```ts
await runCommand({
  command: "buildctl",
  args: ["build", "--frontend=gateway.v0", ...],
  ...
});
```

Without `--addr`, `buildctl` defaults to connecting via the local Unix socket (`unix:///run/buildkit/buildkitd.sock`). That socket doesn't exist on the worker — `buildkitd` runs as a separate container and is only reachable over TCP. The `BUILDKIT_HOST` env var (`tcp://buildkitd:1234`) was wired up in `env.ts` and `docker-compose.yml` but never actually forwarded to the CLI.

**Fix:**

Pass `--addr` as the first argument to `buildctl` in `server/src/pipeline/railpack-build.ts`:

```ts
await runCommand({
  command: "buildctl",
  args: [
    "--addr",
    env.BUILDKIT_HOST,
    "build",
    "--frontend=gateway.v0",
    ...
  ],
  ...
});
```

**Related — running the worker on the host instead of in docker-compose:**

The default `BUILDKIT_HOST` in `env.ts` is `tcp://buildkitd:1234`. That hostname only resolves inside the compose network. When running the worker locally (e.g. `bun run dev`), `buildctl` fails with:

```
lookup buildkitd: no such host
```

The compose file publishes `buildkitd` on host port `1234`, so set in `server/.env`:

```
BUILDKIT_HOST=tcp://localhost:1234
```

---

## 3. Worker: Buildkit build fails with `403 Forbidden` pulling the railpack frontend image

**Error:**

```
error: failed to solve: failed to fetch anonymous token: unexpected status
from GET request to https://ghcr.io/token?scope=repository%3Arailwayapp%2Frailpack%3Apull
&service=ghcr.io: 403 Forbidden
```

**Cause:**

`RAILPACK_FRONTEND_IMAGE` in `server/src/pipeline/railpack-build.ts` was set to:

```ts
const RAILPACK_FRONTEND_IMAGE = "ghcr.io/railwayapp/railpack:railpack-frontend";
```

That reference parses as repo `railwayapp/railpack` with tag `railpack-frontend`. The repo `railwayapp/railpack` does not exist as a public GHCR package, so ghcr.io's anonymous token endpoint returns `403` (ghcr.io returns `403`, not `404`, for nonexistent public repos — which made this look like an auth problem).

The BuildKit frontend is actually published as a **separate package**: `ghcr.io/railwayapp/railpack-frontend`, with tags like `latest`, `v0.0.33`, etc.

**Fix:**

```ts
const RAILPACK_FRONTEND_IMAGE = "ghcr.io/railwayapp/railpack-frontend:latest";
```

**Verifying an image is reachable anonymously:**

```bash
TOKEN=$(curl -s "https://ghcr.io/token?scope=repository:<owner>/<name>:pull&service=ghcr.io" | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" "https://ghcr.io/v2/<owner>/<name>/tags/list"
```

A valid token + a tags list means the repo exists and is public. A `403` on the token endpoint usually means the repo name is wrong or the package is private.

---

## 4. Deployments: user env vars never reach the app even though they're set in the form

**Symptom:**

User sets an env var (e.g. `NAME=Jason`) when creating a deployment. Build completes, container starts, but the deployed app behaves as if the variable is unset (e.g. a Next.js page reading `process.env.NAME || 'Guest'` always renders "Guest"). Restarting the container with `-e NAME=Jason` in `docker run` doesn't help.

**Cause:**

Two problems, layered.

1. **Statically prerendered Next.js pages.** A synchronous Server Component with no dynamic indicators (`cookies()`, `headers()`, `fetch({ cache: 'no-store' })`, `export const dynamic = 'force-dynamic'`) is rendered to HTML at `next build` time. Once the image is built, that HTML is fixed — `docker run -e NAME=...` has no effect on a string already baked into the static file. So the env var **must** be present during the build, not just at container start.

2. **Wrong Railpack contract.** The pipeline was passing user vars to docker as `--build-arg KEY=VALUE`. Railpack's custom BuildKit frontend treats user env vars as **secrets**, not build-args. Per [Railpack docs](https://github.com/railwayapp/railpack/blob/main/docs/src/content/docs/architecture/secrets.md), the required shape with a custom frontend is:

   ```bash
   # 1. Plan time — register the names in the build plan
   railpack prepare <repo> --env NAME=Jason --plan-out plan.json

   # 2. Build time — mount values as BuildKit secrets + cache-busting hash
   NAME=Jason docker buildx build \
     --build-arg BUILDKIT_SYNTAX=ghcr.io/railwayapp/railpack-frontend:latest \
     --secret id=NAME,env=NAME \
     --build-arg secrets-hash=<sha256> \
     -f plan.json <repo>
   ```

   Without `--env` at plan time, no step in the plan has the secret available. Arbitrary `--build-arg` values (other than `BUILDKIT_SYNTAX` and `secrets-hash`) are silently ignored by the Railpack frontend — they don't become env vars during build steps. So `next build` runs with `process.env.NAME` undefined, "Guest" gets baked into the static HTML, and the runtime `-e NAME=...` does nothing.

**Fix:**

Three changes across the pipeline:

1. **[server/src/lib/utils.ts](server/src/lib/utils.ts)** — extend `runCommand` to forward an optional `env` map to the subprocess (execa's `extendEnv: true` default merges with `process.env`):

   ```ts
   type RunStepArgs = {
     ...
     env?: Record<string, string>;
   };

   const subprocess = execa(command, args, {
     stdout: "pipe",
     stderr: "pipe",
     buffer,
     ...(env ? { env } : {}),
   });
   ```

2. **[server/src/pipeline/railpack.ts](server/src/pipeline/railpack.ts)** — pass env names to `railpack prepare` via `--env`, and at build time switch from `--build-arg KEY=VALUE` to BuildKit secrets + a cache-bust hash:

   ```ts
   function computeSecretsHash(env: Record<string, string>): string {
     const sorted = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));
     return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
   }

   // prepare
   for (const [key, value] of Object.entries(env)) {
     prepareArgs.push("--env", `${key}=${value}`);
   }

   // build
   for (const key of envKeys) {
     buildArgs.push("--secret", `id=${key},env=${key}`);
   }
   buildArgs.push("--build-arg", `secrets-hash=${computeSecretsHash(env)}`);

   await runCommand({
     command: "docker",
     args: buildArgs,
     slug,
     ...(envKeys.length > 0 ? { env } : {}), // values read by --secret id=KEY,env=KEY
     ...
   });
   ```

3. **[server/src/worker.ts](server/src/worker.ts)** — fetch the decrypted env vars **before** `railpack prepare` so they end up in the plan's secrets list, then pass the same map to the build:

   ```ts
   const buildEnv = await getEnvVarsDecrypted(slug);
   await runRailpackPrepare(repoDirectory, { slug, env: buildEnv });
   await runRailpackBuild(repoDirectory, { imageTag, slug, env: buildEnv });
   ```

**Why `secrets-hash` matters:**

BuildKit does not invalidate a layer when a secret's *value* changes (it only tracks the names declared in the plan). Without `--build-arg secrets-hash=<sha>`, changing `NAME=Jason` → `NAME=Alex` would hit a cached layer and the new value would never reach `next build`. The hash is a sha256 over the sorted entries, mounted into the layer by Railpack to force cache invalidation when any value changes.

**Caveat — env vars changed *after* the initial build:**

`updateDeployment` saves env vars but does not re-queue a build, and `startDeployment` just runs the existing image. So changing env vars on an existing deployment still won't take effect for statically prerendered pages — the user has to trigger a rebuild (currently: delete and recreate). Wiring env mutations to enqueue a `build` job is a separate fix.
