# Changelog

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
