# Scenario: cross-Pacific transport and encryption

Use this when a host and viewer sit on opposite sides of the Pacific (for
example a US host and a viewer in China) and you want the best available
transport. There is no guaranteed “stable tunnel”; the stack picks the best
path it can negotiate and falls back to the relay.

```text
US host                          cross-Pacific path                 viewer
┌──────────────┐      ┌──────────────────────────────────┐      ┌──────────────┐
│ tokimeki     │      │ 1. direct P2P (best effort)      │      │ CLI viewer   │
│ host         ├─────►│ 2. coturn / Cloudflare TURN UDP  ├─────►│ (P2P/TUN)    │
│              │      │ 3. relay WebSocket (fallback)    │      │ or browser   │
└──────────────┘      └──────────────────────────────────┘      └──────────────┘
```

## Two viewer classes

- **CLI viewer (`tokimeki attach`)** — can negotiate WebRTC P2P, TURN, and the
  opt-in TUN profile. The relay is the control plane and the fallback data
  path.
- **Browser viewer (TokiAPI web viewer)** — relay-only. TokiAPI strips TURN
  credentials from the proxy, and the browser never runs P2P/TUN. This
  scenario's TUN guidance applies to CLI viewers only.

## Transport ladder

1. **Direct P2P DataChannel** — lowest latency, but cross-border UDP may be
   blocked, throttled, or unstable. A failed or not-yet-ready attempt takes
   about 12 seconds.
2. **TURN over UDP** — coturn first, then Cloudflare Realtime TURN. The CLI
   uses TURN over UDP (libjuice); a `turn:...?transport=udp` URL is required.
3. **Relay WebSocket** — always available. Control, signaling, auth, and
   snapshots always use the relay; the relay also carries terminal bytes when
   P2P/TURN is not usable.

After a failed P2P attempt, the host refreshes to the next usable TURN
provider once and retries; a second failure resumes relay output and requests
a fresh snapshot. A TURN attempt that cannot reach the server also ends in a
relay fallback. The PTY/TUI session is not terminated.

## Encryption model

- The relay can see terminal bytes **by design** while it carries them. This
  is not end-to-end encryption.
- `TOKIMEKI_TUNNEL=auto` adds an application-layer tunnel on the P2P
  DataChannel: AES-256-GCM records with HKDF direction keys, selective-repeat
  ARQ (window 64), and a bounded retransmission budget.
- The default `session-token` key mode derives keys from the session token.
  The relay has seen that token and can derive the same keys, so this mode is
  **transport hardening, not end-to-end encryption**.
- `TOKIMEKI_TUNNEL_SECRET` switches to `shared-secret` mode. The relay cannot
  derive those keys, so only this mode may be called **relay-blind**.
- TUN is P2P-only in tokimeki 0.1.7. If the link falls back to the relay, TUN
  is not active and the relay sees terminal bytes again. TUN never protects
  the relay path.

## Recommended configuration

Use the same settings on the host and on a CLI viewer.

```bash
export TOKIMEKI_P2P=auto
export TOKIMEKI_TUNNEL=auto
export TOKIMEKI_TUNNEL_FEC=xor
export TOKIMEKI_TUNNEL_SECRET='<same 16+ byte secret on both ends>'
```

- `TOKIMEKI_TUNNEL=auto` negotiates only when both peers advertise the exact
  tunnel capability and the same key mode. A mismatch falls back to the relay.
- `TOKIMEKI_TUNNEL_FEC=xor` emits one AEAD parity record per full group of
  eight data records. It recovers exactly one lost record; lost parity or
  multiple losses stay on ARQ.
- `TOKIMEKI_TUNNEL_SECRET` must be at least 16 bytes and shared out of band.
  It is scrubbed from the hosted PTY environment and redacted from logs. A
  missing secret on one end prevents negotiation; different values negotiate
  but fail AEAD authentication, then fall back to the relay after the failure
  threshold.
- Do not put the tunnel secret in argv, chat, an invite URL, or a committed
  file. Use a 0600 environment file or the process manager's secret
  mechanism.
- Ensure at least one TURN URL uses UDP. `TOKIMEKI_ICE_TRANSPORT_POLICY=relay`
  is for forced-TURN testing only; with no usable TURN it times out and falls
  back to the relay.
- If you self-host coturn behind NAT, set `external-ip` correctly for your
  provider's network model (a private mapping can break same-host relay
  candidates on direct-IP hosts).

## What to expect

- Cross-Pacific RTT dominates interactive latency. The fixed TUI window keeps
  the grid stable; the local viewport letterboxes or crops.
- ARQ retransmits lost records; XOR FEC recovers only a single lost record per
  group. High loss or reordering can still cause stalls, and the transport
  eventually falls back to the relay.
- No direct-path success rate, long-run stability, or “stable tunnel” is
  guaranteed. Cross-machine tunnel e2e (including forced loss/reorder) is not
  part of the 0.1.7 automated suite; local tunnel e2e covers session-token and
  shared-secret modes.
- The v1.7 line plans optional slow-P2P drain fallback and send pacing
  (`TOKIMEKI_P2P_DRAIN_BYTES_PER_SEC`, `TOKIMEKI_SEND_PACE_BYTES_PER_SEC`).
  These variables are **not shipped in 0.1.7**; do not rely on them yet.

## Verification

Run with debug logs on both ends:

```bash
export TOKIMEKI_LOG_LEVEL=debug
```

Look for:

- a negotiated tunnel / DataChannel, or `tunnel unavailable` with a fallback;
- the `lan=yes|no` diagnostic (P2P candidate locality; diagnostic only);
- a fresh snapshot after a relay fallback;
- no token, secret, or terminal content in logs.

To compare against the relay baseline, run one session with
`TOKIMEKI_P2P=off`; the difference isolates the P2P/TURN path.

## Troubleshooting

| Symptom | Check |
|---|---|
| Tunnel never activates | Both ends use `TOKIMEKI_TUNNEL=auto`, P2P is enabled, and the key mode matches (`TOKIMEKI_TUNNEL_SECRET` present on both or absent on both). |
| Tunnel falls back to relay | Check debug logs for `tunnel unavailable`; a wrong shared secret, high loss, or oversized frames cause fallback. |
| TURN attempt takes ~12 s | Expected when TURN is unreachable; the relay takes over. |
| P2P never opens | Corporate or ISP UDP filtering; try TURN or set `TOKIMEKI_P2P=off`. |
| Browser viewer has no P2P/TUN | Expected: the TokiAPI browser proxy is relay-only. |
| Garbled screen after reconnect | Enable debug logs and report the terminal/OS details. |

## Security checklist

- Share the tunnel secret out of band; never in chat, argv, an invite, or a
  repository.
- Treat the session token, passcode, invite URL, and viewer config as secrets.
- The relay is trusted while it carries bytes. TUN shared-secret mode is
  relay-blind only while the P2P tunnel is active; a relay fallback is not.
- Use short-lived sessions, passcodes, and listener invites where appropriate.
- Tokimeki 0.1.7 has no relay-side Session JWT revocation or viewer eviction;
  those are v1.8 lifecycle items, not shipped here.

## Related

- [Usage reference](../usage.md)
- [Phone → home-NAT ACP](home-nat-mobile.md)
- [US host running Claude Code](us-host-claude-code.md)
- TUN reliability trade-off:
  <https://github.com/limccn/tokimeki/blob/main/docs/tunnel-reliability.md>
- Protocol:
  <https://github.com/limccn/tokimeki/blob/main/docs/protocol.md>
