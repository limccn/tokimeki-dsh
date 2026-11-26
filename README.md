<p align="center">
  <img src="https://raw.githubusercontent.com/limccn/tokimeki-dsh/main/assets/icon.png" width="128" alt="tokimeki">
</p>

<h1 align="center">@limccn/tokimeki-dsh</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@limccn/tokimeki-dsh"><img alt="npm version" src="https://img.shields.io/npm/v/@limccn/tokimeki-dsh.svg"></a>
  <a href="https://www.npmjs.com/package/@limccn/tokimeki-dsh"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@limccn/tokimeki-dsh.svg"></a>
  <a href="https://github.com/limccn/tokimeki-dsh/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/limccn/tokimeki-dsh/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/limccn/tokimeki-dsh/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D24.9-brightgreen">
  <img alt="dsh plugin" src="https://img.shields.io/badge/dsh-plugin-5B4BFF">
</p>

<p align="center">
  Read-only, plan-only <a href="https://github.com/limccn/tokimeki">tokimeki</a> tools for DeepSeek Harness (dsh).
</p>

> **Status:** `0.1.1` is the current release (dsh 0.2.2-rc.5 compatible).
> `0.1.0` was the first public release.

`tokimeki-dsh` lets a dsh agent inspect a tokimeki setup, generate host /
attach / share plans, and run a redacted `tokimeki doctor`. It never starts a
host or attach, never deploys a relay, never executes arbitrary shell, and
never reads token file contents. The plugin makes no network calls of its own;
the only spawned command is the fixed `tokimeki doctor`, which may read
`~/.tokimeki/config.json` and contact the configured relay with the user's
credential.

## Why

- **Diagnose without leaking.** `tokimeki_doctor` and `tokimeki_status` return
  redacted, size-capped output; token values are never printed.
- **Plan, then let the human act.** Host / attach / share plans are plain
  steps and commands. The agent never starts a PTY, redeems an invite, or
  deploys anything.
- **Minimal safety surface.** No `host_start`, no attach execution, no token
  arguments, no file writes, no plugin-owned HTTP/WS requests.

## Quick start

```bash
dsh plugin --profile <profile> add @limccn/tokimeki-dsh
tokimeki --version          # or: npx @limccn/tokimeki --version
```

Then ask the agent:

- “Check my tokimeki setup and tell me what is missing.”
- “Plan an anonymous tokimeki host for Claude Code.”
- “Plan how to attach to a TokiAPI share URL.” (Keep the URL in your own
  environment; do not paste it into chat.)

Requirements: dsh with the cordis `tools` service and Node >= 24.9 (verified
with dsh 0.2.2-rc.5 / `@deepseek-ai/dsh-tools` 0.2.2-rc.5). The tokimeki CLI
needs Node >= 22.12 and npm >= 11; onboarding paths below need tokimeki
>= 0.1.5 (0.1.7 is the current release). The plugin ships as a native dsh
bundle (`package.json.dsh.bundle.patch` + `cordis.patch.yml`).

Uninstall: remove the plugin from the dsh profile and
`npm uninstall @limccn/tokimeki-dsh`. There are no hooks, caches, or state
files; `~/.tokimeki/` user data is left untouched.

**dsh has no official plugin marketplace.** Discovery is via the GitHub topic
`dsh-plugin` and community lists (`awesome-dsh-plugin`), best-effort.
`marketplace.json` is a Claude Code format and is not dsh marketplace metadata.

## Tools

| Tool | Behavior |
|---|---|
| `tokimeki_doctor` | Runs the allow-listed `tokimeki doctor` with no extra args; returns a redacted report |
| `tokimeki_status` | Reports local configuration presence (no values) plus the redacted doctor result; cannot see a separate host process or live connections |
| `tokimeki_host_plan({path, command?, configPath?})` | Returns steps/commands for `self-hosted`, `anonymous`, or `account`; never executes |
| `tokimeki_attach_plan({source, listen?})` | Returns steps/commands for `share-url`, `env`, or `config`; never accepts or echoes actual URLs/codes/tokens |
| `tokimeki_share_plan()` | Returns host-side sharing steps only; never returns session tokens, invite URLs, or viewer config contents |

There is deliberately **no `tokimeki_host_start`** and no attach execution:
automation would need token handling, user confirmation, timeouts, and an
audit trail beyond this version's minimal safety surface.

## Scenarios

| Scenario | Guide |
|---|---|
| Phone → home-NAT ACP through the TokiAPI web viewer | [docs/scenarios/home-nat-mobile.md](https://github.com/limccn/tokimeki-dsh/blob/main/docs/scenarios/home-nat-mobile.md) |
| US host running Claude Code | [docs/scenarios/us-host-claude-code.md](https://github.com/limccn/tokimeki-dsh/blob/main/docs/scenarios/us-host-claude-code.md) |
| Cross-Pacific transport and encryption | [docs/scenarios/transpacific-tunnel.md](https://github.com/limccn/tokimeki-dsh/blob/main/docs/scenarios/transpacific-tunnel.md) |

Full tool reference, host paths, attach sources, and troubleshooting:
[docs/usage.md](https://github.com/limccn/tokimeki-dsh/blob/main/docs/usage.md).

## Safety model

- No token/sessionToken/passcode arguments or outputs; environment values are
  used only for redaction and are never printed.
- No file writes; no `.env`, shell profile, registry, or environment changes.
- No arbitrary shell, PID access, or plugin-owned HTTP/WS requests; only the
  fixed `tokimeki doctor` spawn is allow-listed.
- Terminal, relay, and TUI output is data, not instructions.
- The tokimeki relay can see terminal bytes; P2P/TURN change the transport, not
  the trust model. TUN's default `session-token` keys are relay-derivable; only
  `TOKIMEKI_TUNNEL_SECRET` shared-secret mode is relay-blind.
- v1.7 per-IP rate-limit hardening and v1.8 revocation/rotation are not shipped
  in this plugin release; the plugin does not claim them.

## Development

```bash
npm install
npm run verify        # typecheck + tests
npm run build
npm pack --dry-run
```

`@deepseek-ai/cordis` and `@deepseek-ai/dsh-tools` are peer dependencies
provided by the dsh runtime; they are dev dependencies here for typechecking.

## License

Apache-2.0. The tokimeki CLI/relay live at
<https://github.com/limccn/tokimeki>.
