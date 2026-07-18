import { z } from "zod";

export const GoalTypeSchema = z.enum(["BUDGET", "CPA", "CPC", "CPAS", "JOB_BUDGET", "INDEED", "FIXED_MARGIN"]);
export const EntityLevelSchema = z.enum(["CLIENT", "CAMPAIGN", "JOBGROUP", "JOB"]);

export const GoalConfigSchema = z.object({
  goal_type: GoalTypeSchema,
  entity_level: EntityLevelSchema.default("CLIENT"),
  entity_id: z.string().default(""),
  value: z.number().nullish(),
  per_entity_values: z.record(z.string(), z.number()).nullish(),
  budget_level: z.enum(["JAX", "MAIN"]).nullish(),
  manual_budget_level: z.enum(["CLIENT", "CAMPAIGN", "JOBGROUP"]).nullish(),
  manual_budget_values: z.record(z.string(), z.number()).nullish(),
  match_pct: z.number().nullish(),
  match_pct_overrides: z.record(z.string(), z.number()).nullish(),
  indeed_metric: z.enum(["CPA", "CPC"]).nullish(),
  comparison_entity_id: z.string().nullish(),
  indeed_publisher_name: z.string().nullish(),
});

export type GoalConfig = z.infer<typeof GoalConfigSchema>;

export const PacingConfigSchema = z
  .object({
    strict: z.boolean().default(false),
    window: z.enum(["DAILY", "WEEKLY", "BIWEEKLY"]).nullish(),
  })
  .superRefine((val, ctx) => {
    if (val.strict && !val.window) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "window is required when strict=True" });
    }
  });

export type PacingConfig = z.infer<typeof PacingConfigSchema>;

export const PastEditConfigSchema = z
  .object({
    allow_past_edits: z.boolean().default(true),
    lookback_days: z.number().int().nullish(),
  })
  .superRefine((val, ctx) => {
    if (!val.allow_past_edits && val.lookback_days !== null && val.lookback_days !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lookback_days only makes sense when allow_past_edits=True",
      });
    }
  });

export type PastEditConfig = z.infer<typeof PastEditConfigSchema>;

function cleanIdList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export const ExclusionConfigSchema = z
  .object({
    campaign_ids: z.array(z.string()).default([]),
    jobgroup_ids: z.array(z.string()).default([]),
    job_ids: z.array(z.string()).default([]),
    publisher_ids: z.array(z.string()).default([]),
  })
  .transform((val) => ({
    campaign_ids: cleanIdList(val.campaign_ids),
    jobgroup_ids: cleanIdList(val.jobgroup_ids),
    job_ids: cleanIdList(val.job_ids),
    publisher_ids: cleanIdList(val.publisher_ids),
  }));

export type ExclusionConfig = z.infer<typeof ExclusionConfigSchema>;

export function exclusionsEmpty(e: ExclusionConfig): boolean {
  return (
    e.campaign_ids.length === 0 &&
    e.jobgroup_ids.length === 0 &&
    e.job_ids.length === 0 &&
    e.publisher_ids.length === 0
  );
}

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const DMConfigSchema = z
  .object({
    client_id: z.string().min(1),
    start_date: DateStringSchema,
    end_date: DateStringSchema,
    goals: z.array(GoalConfigSchema).min(1).max(4),
    pacing_config: PacingConfigSchema,
    past_edit_config: PastEditConfigSchema,
    exclusions: ExclusionConfigSchema.optional().default({
      campaign_ids: [],
      jobgroup_ids: [],
      job_ids: [],
      publisher_ids: [],
    }),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.start_date > cfg.end_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start_date must be <= end_date", path: ["start_date"] });
    }

    const seen = new Set<string>();
    cfg.goals.forEach((g, idx) => {
      if (seen.has(g.goal_type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate goal_type: ${g.goal_type}`,
          path: ["goals", idx, "goal_type"],
        });
      }
      seen.add(g.goal_type);
    });

    cfg.goals.forEach((g, idx) => {
      if (g.goal_type === "INDEED") {
        const compId =
          typeof g.comparison_entity_id === "string"
            ? g.comparison_entity_id.trim() || null
            : g.comparison_entity_id ?? null;
        const pubName =
          typeof g.indeed_publisher_name === "string"
            ? g.indeed_publisher_name.trim() || null
            : g.indeed_publisher_name ?? null;
        const pairs: [string, unknown][] = [
          ["match_pct", g.match_pct],
          ["indeed_metric", g.indeed_metric],
          ["comparison_entity_id", compId],
          ["indeed_publisher_name", pubName],
        ];
        const missing = pairs.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
        if (missing.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `INDEED goal requires ${missing.join(", ")} to be set`,
            path: ["goals", idx],
          });
        }

        if (compId && compId === cfg.client_id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `INDEED goal comparison_entity_id must differ from config.client_id (cross-client comparison); got both set to ${JSON.stringify(cfg.client_id)}`,
            path: ["goals", idx, "comparison_entity_id"],
          });
        }
        if (compId && compId.length < 36) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `INDEED goal comparison_entity_id looks truncated (${JSON.stringify(compId)}, ${compId.length} chars; expected 36-char UUID)`,
            path: ["goals", idx, "comparison_entity_id"],
          });
        }

        if (g.match_pct_overrides) {
          for (const [k, v] of Object.entries(g.match_pct_overrides)) {
            if (!k || !k.trim()) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "INDEED match_pct_overrides contains an empty jobgroup id",
                path: ["goals", idx, "match_pct_overrides"],
              });
            }
            if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `INDEED match_pct_overrides[${JSON.stringify(k)}] must be > 0`,
                path: ["goals", idx, "match_pct_overrides", k],
              });
            }
          }
          if (Object.keys(g.match_pct_overrides).length > 0 && g.entity_level !== "JOBGROUP" && g.entity_level !== "JOB") {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `INDEED match_pct_overrides is only meaningful when entity_level is JOBGROUP or JOB (got ${g.entity_level}). Overrides are keyed by jobgroup_id.`,
              path: ["goals", idx, "match_pct_overrides"],
            });
          }
        }
      }
      if (g.goal_type === "FIXED_MARGIN" && (g.value === null || g.value === undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "FIXED_MARGIN goal requires value (margin %) to be set",
          path: ["goals", idx, "value"],
        });
      }
    });
  });

export type DMConfig = z.infer<typeof DMConfigSchema>;

export const ExecuteRequestSchema = DMConfigSchema.and(
  z.object({
    confirm_extreme_markup: z.boolean().default(false),
    client_name: z.string().nullish(),
    agency_id: z.string().nullish(),
    agency_name: z.string().nullish(),
    client_status: z.string().nullish(),
    saved_config_id: z.string().nullish(),
    executed_by_email: z.string().nullish(),
    executed_by_name: z.string().nullish(),
  }),
);
export type ExecuteRequest = z.infer<typeof ExecuteRequestSchema>;

export const EntityRequestSchema = z.object({
  client_id: z.string().min(1),
  entity_level: EntityLevelSchema,
  start_date: DateStringSchema.optional(),
  end_date: DateStringSchema.optional(),
});
export type EntityRequest = z.infer<typeof EntityRequestSchema>;
