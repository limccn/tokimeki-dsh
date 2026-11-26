# Scenario: US host running Claude Code

Use this when an always-on US host (for example a VPS or a `grokbot` box) runs
Claude Code and you want to attach from a laptop or phone. The host only needs
outbound `wss://`; no inbound port or router change is required.

```text
US host (tokimeki)                 relay / TURN                 viewer
┌──────────────────────┐          ┌───────────────┐          ┌──────────────┐
│ `tokimeki claude`    │  wss     │ relay.tokiapi │  wss     │ CLAUDE CODE  │
│ live PTY / Claude    ├─────────►│ .app          │◄─────────┤ laptop CLI   │
│ Code                 │          │ (control)     │          │ or phone web │
└──────────────────────┘          └───────────────┘          └──────────────┘
```

## Prerequisites

- Linux host (Ubuntu/Debian or equivalent) with a stable internet connection.
- Node.js >= 22.12 and npm >= 11.
- The `claude` CLI installed per Anthropic's documentation and authenticated
  on this host. Verify with `claude --version`; complete any Claude Code login
  or API-key setup **before** hosting.
- A relay credential:
  - TokiAPI account: Host JWT (default 30 days) + a 5-character namespace, or
    a downloaded `tokimeki-config.json`; or
  - TokiAPI anonymous: 4-character namespace + 24 h Host JWT; or
  - self-hosted relay: namespace token + namespace.

Do not run the host as `root`. Use a dedicated user; Claude Code inherits that
user's environment and project files.

## 1. Install the CLI and check the host

```bash
node --version      # >= 22.12
npm --version       # >= 11
npm install -g @limccn/tokimeki
tokimeki --version
claude --version
```

`tokimeki doctor` exits 1 until a relay and credential are configured; that is
expected before the next step.

## 2. Configure the credential

### Account path (recommended for an always-on host)

Sign in at <https://tokiapi.app>, create a Host JWT (default 30 days) and a
5-character namespace, then either export the pair:

```bash
export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'
export TOKIMEKI_TOKEN='<host-jwt-or-namespace-token>'
export TOKIMEKI_NAMESPACE='<5-character-namespace>'
tokimeki doctor
```

or download `tokimeki-config.json` and use the top-level `--config` flag:

```bash
chmod 600 tokimeki-config.json
tokimeki --config tokimeki-config.json claude
```

The file contains secrets; delete it when it is no longer needed. A
`--config` file that changes `relayUrl` must also contain the host credential;
never mix a file relay with an environment token.

### Anonymous path (short-lived)

The TokiAPI anonymous flow returns a 4-character namespace, a 24 h Host JWT,
and an invite URL:

```bash
export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'
export TOKIMEKI_TOKEN='<anonymous-host-jwt>'
export TOKIMEKI_NAMESPACE='<4-character-namespace>'
tokimeki doctor
```

Expiry requires a new anonymous request; the namespace/session may change.

### Self-hosted path

Deploy the relay with the Cloudflare Deploy Button or follow
`docs/deploy-cloudflare.md` in the tokimeki repository, configure
`TOKIMEKI_NAMESPACE_TOKENS` (or the single-owner fallback), then use the
relay URL and token locally.

## 3. Start Claude Code

```bash
tokimeki claude
```

- The host runs the existing `claude` binary in a live PTY. Arguments after
  `claude` are passed through to Claude Code.
- `tokimeki claude --help` runs the local `claude --help` without relay
  configuration.
- The default fixed TUI window is `120x40`. ACP commands (`claude`, `pi`,
  `codex`, `gemini`, `cursor`, `aider`, `opencode`, `goose`, `amp`) use the
  fixed window by default; viewer resizes do not change the host PTY.
- Choose a different grid **before** viewers attach:

```bash
export TOKIMEKI_WINDOW_SIZE='140x45'
tokimeki claude
```

- In tokimeki 0.1.7, fixed-grid hosts do not offer the live resize editor;
  live fixed-grid resize is planned for a later release. Non-fixed
  `latest`/`min`/`pinned` hosts can resize through the F12 menu.
- Press F12 for the connection menu: status, show/hide session token, copy
  viewer config (OSC 52), anonymous invite URL, log view. F12 bytes never
  reach Claude Code.

If the host is not attached to a terminal, run it in daemon mode:

```bash
tokimeki --daemon claude
```

Daemon mode writes structured events to stderr as one-line JSON prefixed
`tokimeki-event: ` (`ready`/`status`/`error`/`report`); stdout stays terminal
bytes. Do not merge stdout and stderr when parsing events.

## 4. Run it as a service (systemd example)

The CLI does not install or supervise services. Use your own process manager.
A minimal systemd unit:

```ini
[Unit]
Description=tokimeki host for Claude Code
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<user>
WorkingDirectory=/home/<user>
EnvironmentFile=/home/<user>/.tokimeki/host.env
ExecStart=/usr/local/bin/tokimeki --daemon claude
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM

[Install]
WantedBy=multi-user.target
```

- `ExecStart` must be the absolute path from `command -v tokimeki`.
- `host.env` is a 0600 file with `KEY=value` lines, no `export`. Do not put
  the Host JWT in the unit file or in `ExecStart`.
- Logs go to the journal. The service user must own the Claude Code workspace.

## 5. Attach

Desktop CLI:

```bash
tokimeki attach "https://tokiapi.app/#t-<code>"
# or: TOKIMEKI_ATTACH_URL='https://...#t-<code>' tokimeki attach
```

Environment attach:

```bash
export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'
export TOKIMEKI_SESSION='<session-name>'
export TOKIMEKI_SESSION_TOKEN='<session-token>'
tokimeki attach
```

Phone: use the TokiAPI web viewer; see
[phone → home-NAT ACP](home-nat-mobile.md). The browser is relay-only.

Read-only listener:

```bash
tokimeki attach --listen
```

## 6. Verify

- `tokimeki doctor` reports the relay/credential state without printing the
  token.
- Viewers see the Claude Code screen and can type; the host PTY keeps the
  chosen fixed grid.
- A reconnect requests a fresh snapshot; the Claude Code process keeps
  running.
- Daemon logs show `ready` and viewer status events.

## Troubleshooting

| Symptom | Action |
|---|---|
| `401 unauthorized` | Check relay URL, Host JWT/namespace pair, and `<namespace>.<slug>` session prefix. Run `tokimeki doctor`. |
| `host_offline` | The host service stopped or lost the relay; check `systemctl status` and journal. |
| `session_full` | Concurrent client/listener limit; close unused viewers or raise relay limits. |
| `jwks_unavailable` (503) | Relay cannot fetch JWKS; retry later. |
| Fixed window looks cropped | The local viewer is smaller than `120x40`; enlarge it or start the host with a smaller `TOKIMEKI_WINDOW_SIZE`. |
| Cannot resize the fixed window | Expected in 0.1.7; choose the size before viewers attach. |
| TURN attempt takes ~12 s | Expected when TURN is unreachable; relay takes over. |

## Security and limits

- The Host JWT defaults to 30 days and has no relay-side revocation list in
  tokimeki 0.1.7. A leaked token is valid until expiry; rotate by issuing a
  new token or changing the signing key, then restart hosts.
- The relay can see terminal bytes. P2P/TURN change the transport, not the
  trust model; this is not end-to-end encryption.
- Viewers can type into the same Claude Code session. Use a passcode and
  listener invites for observers.
- Anonymous hosts expire after 24 h; account hosts can outlive them.
- `TOKIMEKI_TOKEN`, session tokens, passcodes, invite URLs, and viewer config
  JSON are secrets. Keep them out of argv, chat, logs, and committed files.

## Related

- [Usage reference](../usage.md)
- [Phone → home-NAT ACP](home-nat-mobile.md)
- [Cross-Pacific transport and encryption](transpacific-tunnel.md)
- tokimeki CLI reference:
  <https://github.com/limccn/tokimeki/blob/main/docs/cli.md>
