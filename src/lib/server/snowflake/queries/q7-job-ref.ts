import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";

const JOBS_TABLE = "JOBS.MODELLED.INBOUND_JOBS";

const SQL = `
SELECT
    job_ref_number,
    job_id
FROM ${JOBS_TABLE}
WHERE client_id = %(client_id)s
  AND job_ref_number IS NOT NULL
`.trim();

export async function getJobRefMapping(clientId: string): Promise<Record<string, string>> {
  const rows = await executeQuery<{ job_ref_number: string; job_id: string }>(SQL, { client_id: clientId });
  const mapping: Record<string, string> = {};
  for (const r of rows) mapping[r.job_ref_number] = r.job_id;
  console.log(`Q7 get_job_ref_mapping: ${Object.keys(mapping).length} mapping(s) for client ${clientId}`);
  return mapping;
}
