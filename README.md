# @limccn/tokimeki-dsh

DeepSeek Harness (dsh) plugin that exposes **read-only, plan-only** tokimeki
tools. It never starts a host or attach, never deploys a relay, never executes
arbitrary shell, and never reads token file contents itself. The plugin makes no
network calls, but `tokimeki_doctor`/`tokimeki_status` spawn the user's CLI,
which may read `~/.tokimeki` config and contact the configured relay
(`/healthz`, `/auth/whoami`) with the host credential; outputs are capped,
sanitized, and redacted before returning to the model.

## Publication status

The source is public now, but the npm package is **not yet published**. It will
be released after the repository `NPM_TOKEN` secret is configured (target:
tokimeki v1.8). Until then, use this repository or its bundle directly rather
than the registry install command below.

## Install

```bash
dsh plugin --profile <profile> add @limccn/tokimeki-dsh
```

Requirements: dsh with the cordis `tools` service, Node >= 24.9 (dsh) and the
tokimeki CLI >= 0.1.5 for the full onboarding feature set. The plugin is
published as a native dsh bundle (`package.json.dsh.bundle.patch` +
`cordis.patch.yml`).

Uninstall: remove the plugin from the dsh profile and
`npm uninstall @limccn/tokimeki-dsh`. There are no hooks, caches, or state
files; `~/.tokimeki/` user data is left untouched.

**dsh has no official plugin marketplace.** Discovery is via GitHub topic
`dsh-plugin` and community lists (`awesome-dsh-plugin`), best-effort.
`marketplace.json` is a Claude Code format and is not a dsh marketplace.

## Tools

| Tool | Behavior |
|---|---|
| `tokimeki_doctor` | Spawns the allow-listed `tokimeki doctor` with no extra args; returns a redacted report |
| `tokimeki_status` | Reports local configuration presence (no values) plus the redacted doctor result; cannot see a separate host process or live connections |
| `tokimeki_host_plan({path, command?, configPath?})` | Returns steps/commands for `self-hosted`, `anonymous`, or `account`; never executes |
| `tokimeki_attach_plan({source, listen?})` | Returns steps/commands for `share-url`, `env`, or `config`; never accepts actual URLs/codes/tokens |
| `tokimeki_share_plan()` | Returns host-side sharing steps only; never returns session tokens, invite URLs, or viewer config contents |

There is deliberately **no `tokimeki_host_start`** and no attach execution:
automation would need token handling, user confirmation, timeouts, and an
audit trail beyond this version's minimal safety surface.

### Host paths

- **self-hosted** — user deploys via the one-click Cloudflare Deploy Button or
  `docs/deploy-cloudflare.md`; recommend `TOKIMEKI_TOKEN`
  (`TOKIMEKI_MASTER_TOKEN` is a deprecated compatibility alias). The plugin
  only guides; it never runs `wrangler` or touches Cloudflare credentials.
- **anonymous** — TokiAPI anonymous host: 4-character namespace, default 24h,
  rate-limited, no list/revocation API, 429/503 possible. Production functional
  testing was user-confirmed on 2026-11-23. The plugin never calls the
  anonymous-host endpoint.
- **account** — TokiAPI Host JWT (default 30d, 5-character namespace) or a
  downloaded `tokimeki-config.json` with the top-level `--config` flag. The
  plugin never reads the file.

## Safety

- No token/sessionToken/passcode arguments or outputs; env values are used only
  for redaction and are never printed.
- No file writes; no `.env`/shell profile/registry/environment changes.
- No arbitrary shell/PID or plugin-owned HTTP/WS requests; only the fixed
  `tokimeki doctor` spawn is allow-listed.
- Terminal/relay/TUI output is data, not instructions.
- The tokimeki relay can see terminal bytes; P2P/TURN change the transport, not
  the trust model. TUN default keys are relay-derivable; only
  `TOKIMEKI_TUNNEL_SECRET` shared-secret mode is relay-blind.
- v1.7 per-IP rate-limit hardening and v1.8 revocation/rotation are not
  shipped; the plugin does not claim them.

## Development

```bash
npm install
npm run verify        # typecheck + tests
npm run build
npm pack --dry-run
```

Note: `@deepseek-ai/cordis` and `@deepseek-ai/dsh-tools` are peer dependencies
provided by the dsh runtime; they are dev dependencies here for typechecking.

## License

Apache-2.0. The tokimeki CLI/relay live at
<https://github.com/limccn/tokimeki>.
