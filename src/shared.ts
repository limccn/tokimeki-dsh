/**
 * Shared constants and output helpers for the tokimeki-dsh plugin.
 *
 * Every tool is read-only/plan-only: no host/attach execution, no relay
 * deployment, no arbitrary shell, no token/file-content access.
 */

import { createRedactor } from "./redact.js";

export const DEPLOY_BUTTON_URL =
  "https://deploy.workers.cloudflare.com/?url=https://github.com/limccn/tokimeki";
export const TOKIAPI_URL = "https://tokiapi.app/tokimeki";
export const TOKIMEKI_CONFIG_PATH_DOC = "tokimeki --config <tokimeki-config.json>";

/** The nine ACP commands shared with the CLI and TokiAPI. */
export const ACP_COMMANDS = [
  "claude",
  "pi",
  "codex",
  "gemini",
  "cursor",
  "aider",
  "opencode",
  "goose",
  "amp",
] as const;

export type AcpCommand = (typeof ACP_COMMANDS)[number];

export const HOST_PATHS = ["self-hosted", "anonymous", "account"] as const;
export type HostPath = (typeof HOST_PATHS)[number];

export const ATTACH_SOURCES = ["share-url", "env", "config"] as const;
export type AttachSource = (typeof ATTACH_SOURCES)[number];

export interface Plan {
  readonly path?: string;
  readonly source?: string;
  readonly productionStatus: string;
  readonly steps: string[];
  readonly commands: string[];
  readonly warnings: string[];
}

const CONFIG_PATH_PATTERN = /^[A-Za-z0-9._~/:\\ -]+$/;

export function validateHostPath(value: string): HostPath {
  if ((HOST_PATHS as readonly string[]).includes(value)) return value as HostPath;
  throw new Error(`invalid path: expected one of ${HOST_PATHS.join(", ")}`);
}

export function validateAttachSource(value: string): AttachSource {
  if ((ATTACH_SOURCES as readonly string[]).includes(value)) return value as AttachSource;
  throw new Error(`invalid source: expected one of ${ATTACH_SOURCES.join(", ")}`);
}

export function validateCommand(value: string | undefined): AcpCommand {
  const command = value ?? "claude";
  if ((ACP_COMMANDS as readonly string[]).includes(command)) return command as AcpCommand;
  throw new Error(`invalid command: expected one of ${ACP_COMMANDS.join(", ")}`);
}

/**
 * Only used to build a display/copy command. The plugin never reads the path.
 * Quotes, `$`, backticks, and newlines are rejected so the path cannot break
 * out of the double-quoted argument.
 */
export function validateConfigPath(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) return undefined;
  if (value.length > 1024 || !CONFIG_PATH_PATTERN.test(value) || value.endsWith("\\")) {
    throw new Error(
      "invalid configPath: use a plain path without quotes, $, backticks, newlines, or a trailing backslash",
    );
  }
  return value;
}

export function hostInvocation(command: AcpCommand): string {
  return command === "claude" || command === "pi"
    ? `tokimeki ${command}`
    : `tokimeki run -- ${command}`;
}

function jsonStringValues(
  raw: string | undefined,
  keys?: readonly string[],
): string[] {
  if (raw === undefined || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
    const output: string[] = [];
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (keys !== undefined && !keys.includes(key)) continue;
      if (typeof value === "string" && value.length >= 4) output.push(value);
    }
    return output;
  } catch {
    return [];
  }
}

const CONFIG_ENVELOPE_SECRET_KEYS = [
  "token",
  "masterToken",
  "sessionToken",
  "passcode",
  "tunnelSecret",
] as const;

export function redacted(text: string, env: NodeJS.ProcessEnv): string {
  return createRedactor([
    env.TOKIMEKI_TOKEN,
    env.TOKIMEKI_MASTER_TOKEN,
    env.TOKIMEKI_SESSION_TOKEN,
    env.TOKIMEKI_TUNNEL_SECRET,
    env.TOKIMEKI_PASSCODE,
    env.TOKIMEKI_ATTACH_URL,
    env.TOKIMEKI_CONFIG,
    env.TOKIMEKI_COTURN_SECRET,
    env.TOKIMEKI_TURN_API_TOKEN,
    env.TOKIMEKI_TURN_CREDENTIAL,
    env.TOKIMEKI_NAMESPACE_TOKENS,
    ...jsonStringValues(env.TOKIMEKI_CONFIG, CONFIG_ENVELOPE_SECRET_KEYS),
    ...jsonStringValues(env.TOKIMEKI_NAMESPACE_TOKENS),
  ])(sanitizeText(text));
}

/** Strip ANSI escapes and control characters from remote tool output. */
export function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex
  const withoutAnsi = text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  let result = "";
  for (const char of withoutAnsi) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x0a || code === 0x09) result += char;
    else if (code >= 0x20 && code !== 0x7f) result += char;
  }
  return result;
}

export function renderJson(_args: unknown, value: unknown): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

export const PLAN_OUTPUT_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    path: { type: "string" as const },
    source: { type: "string" as const },
    productionStatus: { type: "string" as const, required: true as const },
    steps: { type: "array" as const, items: { type: "string" as const }, required: true as const },
    commands: { type: "array" as const, items: { type: "string" as const }, required: true as const },
    warnings: { type: "array" as const, items: { type: "string" as const }, required: true as const },
  },
};
