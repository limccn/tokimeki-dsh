/**
 * Pure plan builders. These functions never execute anything and never accept
 * secrets (share URLs, codes, tokens, or file contents).
 */

import {
  ACP_COMMANDS,
  type AcpCommand,
  type AttachSource,
  DEPLOY_BUTTON_URL,
  type HostPath,
  hostInvocation,
  type Plan,
  TOKIAPI_URL,
  validateAttachSource,
  validateCommand,
  validateConfigPath,
  validateHostPath,
} from "./shared.js";

export interface HostPlanInput {
  readonly path: string;
  readonly command?: string;
  readonly configPath?: string;
}

export function buildHostPlan(input: HostPlanInput): Plan {
  const hostPath: HostPath = validateHostPath(input.path);
  const command: AcpCommand = validateCommand(input.command);
  const configPath = validateConfigPath(input.configPath);
  if (hostPath === "self-hosted") {
    return {
      path: hostPath,
      productionStatus: "self-hosted; the user deploys and owns the relay",
      steps: [
        `Deploy the relay with the Cloudflare Deploy Button: ${DEPLOY_BUTTON_URL}`,
        "Or follow docs/deploy-cloudflare.md in the tokimeki repository.",
        "On the relay, configure TOKIMEKI_NAMESPACE_TOKENS (or the single-owner fallback).",
        "Locally export TOKIMEKI_RELAY_URL, TOKIMEKI_TOKEN (recommended), and TOKIMEKI_NAMESPACE.",
        "Run the host command after the user confirms.",
      ],
      commands: [
        "export TOKIMEKI_RELAY_URL='wss://<your-relay>'",
        "export TOKIMEKI_TOKEN='<user-provided-token>'",
        "export TOKIMEKI_NAMESPACE='<namespace>'",
        hostInvocation(command),
      ],
      warnings: [
        "The plugin only guides deployment: it never runs wrangler or touches Cloudflare credentials.",
        "TOKIMEKI_MASTER_TOKEN is a deprecated compatibility alias; prefer TOKIMEKI_TOKEN.",
        "Do not put real token values in a command line; let the user supply them through their environment.",
      ],
    };
  }
  if (hostPath === "anonymous") {
    return {
      path: hostPath,
      productionStatus: "user-confirmed 2026-11-23 for TokiAPI production functional testing",
      steps: [
        `Open ${TOKIAPI_URL} and request an anonymous host.`,
        "TokiAPI returns a 4-character namespace, a Host JWT, a session, and an invite URL.",
        "Use TOKIMEKI_TOKEN + TOKIMEKI_NAMESPACE from that response; never paste the JWT into chat.",
        "Host JWT and invite default to 24 hours; anonymity has no account, list, or revocation API.",
        "Run the host command after the user confirms.",
      ],
      commands: [
        "export TOKIMEKI_RELAY_URL='wss://relay.tokiapi.app'",
        "export TOKIMEKI_TOKEN='<user-provided-anonymous-host-jwt>'",
        "export TOKIMEKI_NAMESPACE='<provider-generated-namespace>'",
        hostInvocation(command),
      ],
      warnings: [
        "Anonymous hosting is rate-limited (about 10 requests/60s/IP) and can return 429 or 503.",
        "Expiry requires a new anonymous request; the namespace/session may change.",
        "The plugin never calls the anonymous-host endpoint and never handles the JWT.",
      ],
    };
  }
  const configCommand =
    configPath === undefined
      ? hostInvocation(command)
      : command === "claude" || command === "pi"
        ? `tokimeki --config "${configPath}" ${command}`
        : `tokimeki --config "${configPath}" run -- ${command}`;
  return {
    path: hostPath,
    productionStatus: "TokiAPI account Host JWT (default 30 days)",
    steps: [
      "Sign in at https://tokiapi.app and create a Host JWT plus a 5-character namespace.",
      "Either export TOKIMEKI_TOKEN + TOKIMEKI_NAMESPACE, or download tokimeki-config.json.",
      "For a downloaded config, pass its path with the top-level --config flag (before the command).",
      "Run the host command after the user confirms.",
    ],
    commands: configPath === undefined ? [configPathCommandFallback(command)] : [configCommand],
    warnings: [
      "Downloaded config files contain secrets: chmod 600 on POSIX and delete them when done.",
      "A --config file that changes relayUrl must also contain the host credential; never mix a file relay with an env token.",
      "Host JWTs have no relay-side revocation list; rotate by issuing a new token or changing the signing key.",
      configPath === undefined
        ? "The plugin does not read or parse the config file; pass the path only."
        : "The plugin did not read the config file; the path is only interpolated into this plan.",
    ],
  };
}

function configPathCommandFallback(command: AcpCommand): string {
  // Kept simple: the account path prefers the downloaded --config form, but
  // the plan stays useful when the user has not downloaded one yet.
  return command === "claude" || command === "pi"
    ? `tokimeki --config "<tokimeki-config.json>" ${command}`
    : `tokimeki --config "<tokimeki-config.json>" run -- ${command}`;
}

export interface AttachPlanInput {
  readonly source: string;
  readonly listen?: boolean;
}

export function buildAttachPlan(input: AttachPlanInput): Plan {
  const source: AttachSource = validateAttachSource(input.source);
  const listen = input.listen === true;
  const command = listen ? "tokimeki attach --listen" : "tokimeki attach";
  if (source === "share-url") {
    return {
      source,
      productionStatus: "TokiAPI share URL; exchange returns a short-lived Session JWT",
      steps: [
        "Ask the user to provide the share URL through TOKIMEKI_ATTACH_URL or the CLI position argument.",
        "The CLI fetches /api/config and exchanges the #t-<code> fragment through /api/tokimeki/attach/cli.",
        "The Session JWT stays in memory and is never written to config/history.",
        "Run the attach command only after the user provides the URL and confirms.",
      ],
      commands: ["export TOKIMEKI_ATTACH_URL='<user-provided-share-url>'", command],
      warnings: [
        "The share URL is a capability secret; do not paste it into chat or command history.",
        "The provider relay URL must be wss:// and bound to the TokiAPI origin; reject other schemes/hosts.",
        "If the invite is a viewer invite, --listen is rejected; listener mode comes from the invite.",
      ],
    };
  }
  if (source === "env") {
    return {
      source,
      productionStatus: "user-provided session and session token",
      steps: [
        "The user supplies TOKIMEKI_SESSION and TOKIMEKI_SESSION_TOKEN in their own environment.",
        "Optionally set TOKIMEKI_RELAY_URL and TOKIMEKI_PASSCODE.",
        "Run the attach command after the user confirms.",
      ],
      commands: [command],
      warnings: [
        "Never print, copy, or ask for the session token value.",
        "Do not place tokens in argv, shell history, logs, or chat.",
        "A listener receives snapshots only and sends no input/resize/ACK.",
      ],
    };
  }
  return {
    source,
    productionStatus: "user-prepared TOKIMEKI_CONFIG viewer JSON",
    steps: [
      "The user places the viewer config JSON in TOKIMEKI_CONFIG in their own environment.",
      "Do not paste the JSON into a command line or tool argument.",
      "Run the attach command after the user confirms.",
    ],
    commands: [command],
    warnings: [
      "Viewer config JSON contains the session token; treat it as a secret.",
      "The plugin never reads config contents and never constructs token-bearing command lines.",
      "A --config file is host-only; attach uses TOKIMEKI_CONFIG or explicit session variables.",
    ],
  };
}

export function buildSharePlan(): Plan {
  return {
    productionStatus: "host-side sharing only",
    steps: [
      "On the host, press F12 (or the configured TOKIMEKI_INVITE_KEY) to open the connection menu.",
      "Choose 'Show/hide session token' only if the user explicitly wants it on screen.",
      "Choose 'Copy viewer config (OSC 52)' to copy the version 1 viewer config.",
      "Alternatively read the startup banner's viewer config line.",
      "Send the config through a channel the user considers secure.",
    ],
    commands: [],
    warnings: [
      "The viewer config contains the session token; never print it in chat or logs.",
      "OSC 52/clipboard managers may retain the value; do not claim the clipboard was cleared.",
      "An anonymous-host invite URL is shown once in memory and is never saved; share it only with the intended viewer.",
      "The relay can see terminal bytes; viewers can type unless the session is listener-only.",
    ],
  };
}

/** Commands the plugin is allowed to mention; exported for tests/docs. */
export const MENTIONED_COMMANDS = ACP_COMMANDS;
