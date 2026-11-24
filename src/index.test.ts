import { describe, expect, it } from "vitest";

import type { Context } from "@deepseek-ai/cordis";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";

import { apply, inject, name } from "./index.js";

describe("tokimeki-dsh plugin registration", () => {
  it("registers only the five read-only/plan tools", () => {
    const registered: ToolDefinition[] = [];
    const ctx = {
      tools: {
        register: (definition: ToolDefinition) => {
          registered.push(definition);
          return () => {};
        },
      },
    } as unknown as Context;
    apply(ctx);
    expect(name).toBe("tokimeki-dsh");
    expect(inject).toEqual(["tools"]);
    expect(registered.map((tool) => tool.name)).toEqual([
      "tokimeki_doctor",
      "tokimeki_status",
      "tokimeki_host_plan",
      "tokimeki_attach_plan",
      "tokimeki_share_plan",
    ]);
    expect(registered.some((tool) => tool.name === "tokimeki_host_start")).toBe(false);
  });
});
