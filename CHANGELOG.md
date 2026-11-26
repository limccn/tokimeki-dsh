# Changelog

## [0.1.1] - 2026-11-26

- Widen the `@deepseek-ai/dsh-tools` peer range to
  `^0.0.1-rc.1 || ^0.2.2-rc.5` and typecheck against `0.2.2-rc.5`, so dsh
  0.2.2-rc.5 accepts the plugin instead of rejecting the old peer requirement.
- No tool behavior changes; the five read-only/plan-only tools are unchanged.

## [0.1.0] - 2026-11-23

- Initial native dsh bundle: `tokimeki_doctor`, `tokimeki_status`,
  `tokimeki_host_plan`, `tokimeki_attach_plan`, `tokimeki_share_plan`.
- Read-only/plan-only: no host_start, no attach execution, no deployment, no
  arbitrary shell, no token/file-content access, no plugin-owned network calls.
- Redacted doctor execution (fixed `tokimeki doctor` allow-list), 15s timeout,
  64 KiB output cap, ANSI/control-character stripping.
- Host paths aligned with the tokimeki v1.4 skill: self-hosted (one-click
  deploy, guide-only), TokiAPI anonymous (24h/rate-limited/no revocation), and
  TokiAPI account (30d Host JWT or downloaded `--config`).
- README rewritten with the shared tokimeki icon, npm/CI/license/Node badges,
  and a shorter quick-start-first structure; detailed material moved to docs.
- New `docs/usage.md` (tool reference, host paths, attach sources, listener,
  passcode, troubleshooting) and three scenario guides: home-NAT mobile via
  the TokiAPI web viewer, US host running Claude Code, and cross-Pacific
  transport/encryption.
- First public npm release: `0.1.0`.
