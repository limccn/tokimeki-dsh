# Scenario: phone → home-NAT ACP through the TokiAPI web viewer

Use this when the ACP program (for example Claude Code) runs on a home machine
behind broadband NAT, and the viewer is a phone browser. The phone never
touches the home router: TokiAPI and the tokimeki relay carry the session.

```text
home PC (behind NAT)                 internet                 phone
┌──────────────────────┐          ┌───────────────┐       ┌──────────────┐
│ tokimeki host        │  wss     │ relay         │  wss  │ TokiAPI web  │
│ `tokimeki claude`    ├─────────►│ relay.tokiapi │◄──────┤ viewer       │
│ live PTY / Claude    │          │ .app          │       │ (xterm.js)   │
└──────────────────────┘          └───────────────┘       └──────────────┘
```

## What works — and what does not

- **No port forwarding.** The host only makes outbound `wss://` connections.
- **The browser viewer is relay-only.** TokiAPI's WS proxy strips TURN
  credentials, so a browser viewer never uses P2P or TUN. P2P/TURN/TUN are
  for CLI viewers on desktops or laptops.
- **TokiAPI owns the browser flow.** The phone opens a TokiAPI share URL; the
  relay and the browser viewer are bound to the TokiAPI provider
  (`wss://relay.tokiapi.app`). A self-hosted relay without a TokiAPI web
  viewer needs a CLI viewer instead.
- **The viewer can type.** Unless the invite is a listener invite, the phone
  has the same shared control as any other viewer. Set a passcode when the
  link may be forwarded.

## Prerequisites

On the home host:

- Node.js >= 22.12 and npm >= 11.
- `tokimeki` CLI >= 0.1.5 (0.1.7 is current):
  `npm install -g @limccn/tokimeki`.
- The ACP program itself, for example the `claude` CLI, installed and
  authenticated on that host. Verify with `claude --version`.
- A relay credential:
  - TokiAPI account: Host JWT + namespace, or a downloaded
    `tokimeki-config.json`; or
  - TokiAPI anonymous: 4-character namespace + 24 h Host JWT; or
  - self-hosted relay: namespace token + namespace.

On the phone:

- A modern browser.
- The TokiAPI share URL for this session (a capability secret).

## 1. Preflight on the home host

```bash
tokimeki --version
tokimeki doctor
```

`tokimeki doctor` exits 1 until relay/credential configuration exists; that is
expected before step 2. Do not paste tokens or the invite URL into a chat
window.

## 2. Start the host

Account / downloaded config:

```bash
tokimeki --config tokimeki-config.json claude
```

Account with environment credentials:

```bash
export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'
export TOKIMEKI_TOKEN='<host-jwt-or-namespace-token>'
export TOKIMEKI_NAMESPACE='<namespace>'
tokimeki claude
```

Anonymous:

```bash
export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'
export TOKIMEKI_TOKEN='<anonymous-host-jwt>'
export TOKIMEKI_NAMESPACE='<4-character-namespace>'
tokimeki claude
```

Optional passcode (the host sends only a PBKDF2 verifier):

```bash
export TOKIMEKI_PASSCODE='<6..128 visible ASCII chars>'
tokimeki claude
```

The host prints a startup banner with the session name, relay, viewer count,
window size, and a one-line viewer config. The default fixed TUI window is
`120x40`; the phone viewport letterboxes or crops it and follows the TUI
cursor.

## 3. Create or copy the share URL

- **Anonymous host:** the TokiAPI anonymous flow returns an invite URL. The
  host's F12 menu can show/copy it (memory-only, never saved).
- **Account host:** create an invite/share link in the TokiAPI console for the
  session.
- **CLI viewer instead of a browser:** press F12 on the host and copy the
  viewer config JSON, or read the banner line. Treat it as a secret.

An invite URL looks like `https://tokiapi.app/#t-<code>`. The code is a
capability secret; anyone who redeems it joins the session (subject to the
passcode and role).

## 4. Join from the phone

1. Open the share URL in the phone browser.
2. If TokiAPI asks for a passcode, enter the same `TOKIMEKI_PASSCODE` value.
3. Wait for the snapshot. The browser is relay-only, so there is no P2P/TUN
   negotiation to wait for.
4. Use the terminal keyboard to type. With a fixed grid, the host PTY does not
   resize when the phone rotates; the local viewport changes instead.

A TokiAPI share ticket is single-use and short-lived. After a network switch,
tab discard, or browser restart, **open the share URL again**; do not expect an
old WebSocket to reconnect with a consumed ticket. `410` means the invite is
invalid, expired, or revoked; ask the host for a fresh one.

## 5. Verify

- The phone shows the current host screen, not a blank terminal.
- Typing on the phone appears in the hosted program.
- A second viewer sees the same screen; all viewers share control.
- After closing the phone tab and reopening the share URL, a fresh snapshot
  appears.
- With `TOKIMEKI_PASSCODE` set, a wrong passcode is rejected and a correct one
  is accepted.

## Troubleshooting

| Symptom | Action |
|---|---|
| `410` on the share URL | Invite expired/revoked; create a new one. |
| `passcode_required` | Enter the host's passcode. |
| `passcode_invalid` / `passcode_locked` | Wrong passcode; 0.1.7 locks verification for 30 s after five failures. |
| `host_offline` | The home host process stopped or lost the relay; restart it and create a new invite if needed. |
| `429` | TokiAPI or the relay is rate limiting; wait and retry, do not loop. |
| Blank phone screen after reconnect | Reopen the share URL; the ticket is single-use. |
| Phone keyboard does not type | Tap the terminal first; ensure the invite is a viewer invite, not a listener invite. |

## Security and limits

- The share URL, passcode, and viewer config are secrets. Send them through a
  channel you trust; do not post them in group chats or logs.
- The relay can see terminal bytes. This scenario is not end-to-end encrypted.
- The browser viewer is relay-only; TUN/P2P do not apply to it.
- The phone and the home host share one live PTY. A viewer can type into the
  same Claude Code session; use a listener invite for read-only watchers.
- TokiAPI's attach cookie is origin-wide and a pending ticket is single-use.
  Treat one active share link per browser profile as the supported behavior;
  opening two different links in the same profile can consume the wrong
  ticket.
- Anonymous hosts expire after 24 h by default and have no revocation API;
  end the session by stopping the host. Account Host JWTs default to 30 days
  and have no relay-side revocation list in tokimeki 0.1.7.

## Related

- [Usage reference](../usage.md)
- [US host running Claude Code](us-host-claude-code.md)
- [Cross-Pacific transport and encryption](transpacific-tunnel.md)
- TokiAPI web viewer contract:
  <https://github.com/limccn/tokimeki/blob/main/docs/web-viewer.md>
