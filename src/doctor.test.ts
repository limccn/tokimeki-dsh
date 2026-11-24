import { describe, expect, it, vi } from "vitest";

import { buildStatus, runTokimekiDoctor } from "./doctor.js";

describe("allow-listed doctor execution", () => {
  it("spawns only the fixed doctor command and redacts secrets", async () => {
    const spawnImpl = vi.fn(async () => ({
      exitCode: 1,
      stdout: "token host-secret-value\nresult: 1 check(s) failed",
      stderr: "warning passcode=passcode-secret",
      timedOut: false,
    }));
    const env = {
      TOKIMEKI_TOKEN: "host-secret-value",
      TOKIMEKI_PASSCODE: "passcode-secret",
    };
    const result = await runTokimekiDoctor({ env, spawnImpl });
    expect(result.ok).toBe(false);
    expect(result.output).not.toContain("host-secret-value");
    expect(result.output).not.toContain("passcode-secret");
    expect(result.output).toContain("[redacted]");
    const call = spawnImpl.mock.calls[0] as unknown as [
      string,
      string[],
      { env: NodeJS.ProcessEnv; timeoutMs: number },
    ];
    if (process.platform === "win32") {
      expect(call?.[1]).toEqual(["/d", "/s", "/c", "tokimeki", "doctor"]);
      expect(call?.[2]?.env.NoDefaultCurrentDirectoryInExePath).toBe("1");
    } else {
      expect(call?.[0]).toBe("tokimeki");
      expect(call?.[1]).toEqual(["doctor"]);
    }
  });

  it("redacts share URLs, config envelopes, and namespace maps", async () => {
    const spawnImpl = vi.fn(async () => ({
      exitCode: 0,
      stdout:
        "share https://provider.example/#t-secret-code config config-token-value namespace namespace-token-value",
      stderr: "",
      timedOut: false,
    }));
    const result = await runTokimekiDoctor({
      env: {
        TOKIMEKI_ATTACH_URL: "https://provider.example/#t-secret-code",
        TOKIMEKI_CONFIG: JSON.stringify({ token: "config-token-value" }),
        TOKIMEKI_NAMESPACE_TOKENS: JSON.stringify({ "team-a": "namespace-token-value" }),
      },
      spawnImpl,
    });
    expect(result.output).not.toContain("t-secret-code");
    expect(result.output).not.toContain("config-token-value");
    expect(result.output).not.toContain("namespace-token-value");
    expect(result.output).toContain("[redacted]");
  });

  it("reports timeouts and spawn failures as not ok", async () => {
    const timedOut = await runTokimekiDoctor({
      spawnImpl: async () => ({ exitCode: null, stdout: "", stderr: "", timedOut: true }),
    });
    expect(timedOut.ok).toBe(false);
    expect(timedOut.output).toContain("timed out");

    const failed = await runTokimekiDoctor({
      spawnImpl: async () => ({
        exitCode: null,
        stdout: "",
        stderr: "spawn tokimeki ENOENT",
        timedOut: false,
      }),
    });
    expect(failed.ok).toBe(false);
    expect(failed.output).toContain("ENOENT");
  });

  it("builds status from env presence and never echoes token values", () => {
    const status = buildStatus({
      env: {
        TOKIMEKI_RELAY_URL: "wss://relay.example",
        TOKIMEKI_TOKEN: "host-token-value",
        TOKIMEKI_NAMESPACE: "abcde",
        TOKIMEKI_SESSION: "abcde.laptop",
        TOKIMEKI_SESSION_TOKEN: "session-token-value",
      },
      doctor: { ok: true, exitCode: 0, output: "ok" },
    });
    expect(status.configured).toBe(true);
    expect(status.authMode).toBe("token");
    expect(status.relay).toBe("wss://relay.example");
    expect(status.namespace).toBe("abcde");
    expect(status.doctorOk).toBe(true);
    expect(JSON.stringify(status)).not.toContain("host-token-value");
    expect(JSON.stringify(status)).not.toContain("session-token-value");
  });

  it("drops unsafe non-secret fields instead of echoing them", () => {
    const status = buildStatus({
      env: {
        TOKIMEKI_RELAY_URL: "wss://relay.example/\x1b[31m",
        TOKIMEKI_SESSION: "bad session\n",
      },
    });
    expect(status.relay).toBeUndefined();
    expect(status.session).toBeUndefined();
  });
});
