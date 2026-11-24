/**
 * Allow-listed CLI execution for the read-only doctor/status tools.
 *
 * The only spawned command is `tokimeki doctor` (never arbitrary args, never a
 * shell on POSIX; on Windows the fixed command goes through ComSpec because npm
 * shims are `.cmd`). Output is capped, control-character-stripped, and redacted.
 */

import { spawn } from "node:child_process";

import { redacted, sanitizeText } from "./shared.js";

const MAX_OUTPUT_BYTES = 64 * 1024;
const DOCTOR_TIMEOUT_MS = 15_000;

export interface CommandResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

export type SpawnImpl = (
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv; readonly timeoutMs: number },
) => Promise<CommandResult>;

function defaultSpawn(
  command: string,
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv; readonly timeoutMs: number },
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    const append = (current: string, chunk: Buffer): string => {
      const next = current + chunk.toString("utf8");
      return next.length > MAX_OUTPUT_BYTES ? next.slice(0, MAX_OUTPUT_BYTES) : next;
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, [...args], {
        env: options.env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        exitCode: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : "spawn failed",
        timedOut: false,
      });
      return;
    }
    let timer: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      if (killTimer !== null) clearTimeout(killTimer);
      resolve({ exitCode: code, stdout, stderr, timedOut });
    };
    timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // best effort
      }
      // A SIGTERM-ignoring child or a Windows cmd.exe wrapper must not leave the
      // tool promise pending forever. Escalate after a bounded grace period.
      killTimer = setTimeout(() => {
        if (process.platform === "win32" && child.pid !== undefined) {
          try {
            spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
              windowsHide: true,
            }).on("error", () => {
              // best effort
            });
          } catch {
            // best effort
          }
        } else {
          try {
            child.kill("SIGKILL");
          } catch {
            // best effort
          }
        }
        finish(null);
      }, 2_000);
      killTimer.unref?.();
    }, options.timeoutMs);
    timer.unref?.();
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.on("error", (error) => {
      stderr = append(stderr, Buffer.from(error.message, "utf8"));
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

export interface DoctorOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly spawnImpl?: SpawnImpl;
  readonly timeoutMs?: number;
}

export interface DoctorResult {
  readonly ok: boolean;
  readonly exitCode: number | null;
  readonly output: string;
}

export async function runTokimekiDoctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const baseEnv = options.env ?? process.env;
  const env =
    process.platform === "win32"
      ? { ...baseEnv, NoDefaultCurrentDirectoryInExePath: "1" }
      : baseEnv;
  const spawnImpl = options.spawnImpl ?? defaultSpawn;
  const command =
    process.platform === "win32" ? (env.ComSpec ?? "cmd.exe") : "tokimeki";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "tokimeki", "doctor"]
      : ["doctor"];
  const result = await spawnImpl(command, args, {
    env,
    timeoutMs: options.timeoutMs ?? DOCTOR_TIMEOUT_MS,
  });
  const combined = [result.stdout, result.stderr].filter((part) => part.length > 0).join("\n");
  const suffix = result.timedOut ? "\n[tokimeki doctor timed out]" : "";
  return {
    ok: result.exitCode === 0 && !result.timedOut,
    exitCode: result.exitCode,
    output: redacted(`${combined}${suffix}`.trim(), env),
  };
}

export interface StatusInput {
  readonly env?: NodeJS.ProcessEnv;
  readonly doctor?: DoctorResult;
}

const SAFE_RELAY = /^wss?:\/\/[A-Za-z0-9.:[\]_-]+$/;
const SAFE_NAMESPACE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const SAFE_SESSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function safe(value: string | undefined, pattern: RegExp): string | undefined {
  return value !== undefined && pattern.test(value) ? value : undefined;
}

export function buildStatus(input: StatusInput = {}): {
  configured: boolean;
  authMode: "token" | "master" | "none";
  hasSessionToken: boolean;
  relay?: string;
  namespace?: string;
  session?: string;
  doctorOk: boolean;
  doctorExitCode: number | null;
  doctorOutput: string;
  availablePaths: string[];
} {
  const env = input.env ?? process.env;
  const token = env.TOKIMEKI_TOKEN;
  const master = env.TOKIMEKI_MASTER_TOKEN;
  const authMode = token !== undefined && token.length > 0
    ? "token"
    : master !== undefined && master.length > 0
      ? "master"
      : "none";
  const sessionToken = env.TOKIMEKI_SESSION_TOKEN;
  const hasSessionToken = sessionToken !== undefined && sessionToken.length > 0;
  const session = safe(env.TOKIMEKI_SESSION, SAFE_SESSION);
  const relay = safe(env.TOKIMEKI_RELAY_URL, SAFE_RELAY);
  const namespace = safe(env.TOKIMEKI_NAMESPACE, SAFE_NAMESPACE);
  const hostReady = authMode !== "none";
  const attachReady = session !== undefined && hasSessionToken;
  const doctor = input.doctor;
  return {
    configured: relay !== undefined && (hostReady || attachReady),
    authMode,
    hasSessionToken,
    ...(relay === undefined ? {} : { relay }),
    ...(namespace === undefined ? {} : { namespace }),
    ...(session === undefined ? {} : { session }),
    doctorOk: doctor?.ok === true,
    doctorExitCode: doctor?.exitCode ?? null,
    doctorOutput: sanitizeText(doctor?.output ?? "").slice(0, MAX_OUTPUT_BYTES),
    availablePaths: ["self-hosted", "anonymous", "account"],
  };
}
