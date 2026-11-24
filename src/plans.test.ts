import { describe, expect, it } from "vitest";

import { buildAttachPlan, buildHostPlan, buildSharePlan } from "./plans.js";
import { ACP_COMMANDS, sanitizeText } from "./shared.js";

describe("tokimeki-dsh plans", () => {
  it("guides self-hosted hosting without executing deployment", () => {
    const plan = buildHostPlan({ path: "self-hosted", command: "codex" });
    expect(plan.path).toBe("self-hosted");
    expect(plan.steps.join("\n")).toContain("deploy.workers.cloudflare.com");
    expect(plan.commands).toContain("tokimeki run -- codex");
    expect(plan.warnings.join("\n")).toContain("never runs wrangler");
    expect(plan.warnings.join("\n")).toContain("TOKIMEKI_MASTER_TOKEN");
  });

  it("describes anonymous hosting limits without calling anon-host", () => {
    const plan = buildHostPlan({ path: "anonymous" });
    expect(plan.steps.join("\n")).toContain("tokiapi.app/tokimeki");
    expect(plan.warnings.join("\n")).toContain("429");
    expect(plan.warnings.join("\n")).toContain("never calls");
    expect(plan.productionStatus).toContain("2026-11-23");
  });

  it("supports the account --config template without reading the file", () => {
    const plan = buildHostPlan({
      path: "account",
      command: "gemini",
      configPath: "C:/Users/me/tokimeki-config.json",
    });
    expect(plan.commands.join("\n")).toContain(
      'tokimeki --config "C:/Users/me/tokimeki-config.json" run -- gemini',
    );
    expect(plan.warnings.join("\n")).toContain("did not read");
    expect(() =>
      buildHostPlan({ path: "account", configPath: 'bad"; rm -rf /' }),
    ).toThrow(/invalid configPath/);
    expect(() =>
      buildHostPlan({ path: "account", configPath: "C:\\Users\\me\\" }),
    ).toThrow(/invalid configPath/);
  });

  it("rejects unknown paths and commands", () => {
    expect(() => buildHostPlan({ path: "internet" })).toThrow(/invalid path/);
    expect(() => buildHostPlan({ path: "self-hosted", command: "bash" })).toThrow(
      /invalid command/,
    );
  });

  it("never includes actual share URLs or tokens in attach plans", () => {
    const plan = buildAttachPlan({ source: "share-url", listen: false });
    expect(plan.commands.join("\n")).toContain("tokimeki attach");
    expect(plan.commands.join("\n")).not.toContain("#t-");
    expect(plan.warnings.join("\n")).toContain("capability secret");
    const listener = buildAttachPlan({ source: "env", listen: true });
    expect(listener.commands).toContain("tokimeki attach --listen");
    expect(listener.warnings.join("\n")).toContain("listener");
    const config = buildAttachPlan({ source: "config" });
    expect(config.warnings.join("\n")).toContain("TOKIMEKI_CONFIG");
    expect(config.warnings.join("\n")).toContain("host-only");
  });

  it("returns sharing steps without secrets", () => {
    const plan = buildSharePlan();
    const text = JSON.stringify(plan);
    expect(plan.steps.join("\n")).toContain("F12");
    expect(text).not.toContain("sessionToken");
    expect(text).not.toContain("#t-");
    expect(plan.warnings.join("\n")).toContain("clipboard");
  });

  it("exports exactly the nine ACP commands", () => {
    expect([...ACP_COMMANDS]).toEqual([
      "claude",
      "pi",
      "codex",
      "gemini",
      "cursor",
      "aider",
      "opencode",
      "goose",
      "amp",
    ]);
  });

  it("sanitizes ANSI/control characters from external output", () => {
    expect(sanitizeText("a\x1b[31mred\x1b[0m\nb\x07c")).toBe("ared\nbc");
  });
});
