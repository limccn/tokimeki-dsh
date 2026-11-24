/**
 * @limccn/tokimeki-dsh — DeepSeek Harness (dsh) native plugin.
 *
 * Registers read-only/plan-only tools:
 *   tokimeki_doctor, tokimeki_status, tokimeki_host_plan,
 *   tokimeki_attach_plan, tokimeki_share_plan
 *
 * There is deliberately no host_start/attach_start: the plugin never starts a
 * PTY, never deploys a relay, never executes arbitrary shell, never reads token
 * files, and never makes its own network calls.
 */

import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";

import { buildStatus, runTokimekiDoctor } from "./doctor.js";
import { buildAttachPlan, buildHostPlan, buildSharePlan } from "./plans.js";
import {
  ACP_COMMANDS,
  ATTACH_SOURCES,
  HOST_PATHS,
  PLAN_OUTPUT_SCHEMA,
  renderJson,
} from "./shared.js";

export const name = "tokimeki-dsh";
export const inject = ["tools"];

const EXIT_CODE_SCHEMA = {
  required: true as const,
  oneOf: [{ type: "integer" as const }, { type: "null" as const }] as const,
};

export function apply(ctx: Context): void {
  ctx.tools.register(
    defineTool({
      name: "tokimeki_doctor",
      description:
        "Run the allow-listed `tokimeki doctor` command and return its redacted report. Read-only; never starts host/attach.",
      parameters: {},
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean", required: true },
            exitCode: EXIT_CODE_SCHEMA,
            output: { type: "string", required: true },
          },
        },
        render: renderJson,
      },
      async execute() {
        const result = await runTokimekiDoctor();
        return { ok: result.ok, exitCode: result.exitCode, output: result.output };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "tokimeki_status",
      description:
        "Report local tokimeki configuration presence (never values) plus the redacted doctor result. Cannot observe a separately running host or live connections.",
      parameters: {},
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            configured: { type: "boolean", required: true },
            authMode: { type: "string", required: true, enum: ["token", "master", "none"] },
            hasSessionToken: { type: "boolean", required: true },
            relay: { type: "string" },
            namespace: { type: "string" },
            session: { type: "string" },
            doctorOk: { type: "boolean", required: true },
            doctorExitCode: EXIT_CODE_SCHEMA,
            doctorOutput: { type: "string", required: true },
            availablePaths: {
              type: "array",
              items: { type: "string" },
              required: true,
            },
          },
        },
        render: renderJson,
      },
      async execute() {
        const doctor = await runTokimekiDoctor();
        return buildStatus({ doctor });
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "tokimeki_host_plan",
      description:
        "Return host steps/commands for one of three paths: self-hosted relay, TokiAPI anonymous host, or TokiAPI account. Plan only; never executes or deploys.",
      parameters: {
        path: {
          type: "string",
          required: true,
          enum: [...HOST_PATHS],
          description: "self-hosted | anonymous | account",
        },
        command: {
          type: "string",
          enum: [...ACP_COMMANDS],
          description: "ACP command to host (default claude)",
        },
        configPath: {
          type: "string",
          description:
            "Path to a downloaded tokimeki-config.json (interpolated into the plan only; never read)",
        },
      },
      output: {
        schema: PLAN_OUTPUT_SCHEMA,
        render: renderJson,
      },
      async execute(args) {
        return {
          ...buildHostPlan({
            path: args.path,
            ...(args.command === undefined ? {} : { command: args.command }),
            ...(args.configPath === undefined ? {} : { configPath: args.configPath }),
          }),
        };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "tokimeki_attach_plan",
      description:
        "Return attach steps/commands for a share URL, explicit environment variables, or a user-prepared TOKIMEKI_CONFIG. Never accepts or echoes actual URL/code/token values and never attaches.",
      parameters: {
        source: {
          type: "string",
          required: true,
          enum: [...ATTACH_SOURCES],
          description: "share-url | env | config",
        },
        listen: {
          type: "boolean",
          description: "Return the read-only --listen variant",
        },
      },
      output: {
        schema: PLAN_OUTPUT_SCHEMA,
        render: renderJson,
      },
      async execute(args) {
        return {
          ...buildAttachPlan({
            source: args.source,
            ...(args.listen === undefined ? {} : { listen: args.listen }),
          }),
        };
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "tokimeki_share_plan",
      description:
        "Return host-side sharing steps (F12 menu, session token handling, viewer config copy). Never returns session tokens, invite URLs, or viewer config contents.",
      parameters: {},
      output: {
        schema: PLAN_OUTPUT_SCHEMA,
        render: renderJson,
      },
      async execute() {
        return { ...buildSharePlan() };
      },
    }),
  );
}

export default apply;
