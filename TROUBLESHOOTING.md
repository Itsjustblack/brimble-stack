# Troubleshooting

A log of hard-to-diagnose issues and their fixes.

---

## Worker: `railpack prepare` fails with "no such file or directory" on `/var/lib/railpack/tmp`

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

## Worker: Buildkit build fails immediately — `buildctl` can't reach the daemon

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

## Worker: Buildkit build fails with `403 Forbidden` pulling the railpack frontend image

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
