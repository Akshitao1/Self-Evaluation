import "server-only";
import { executeQuery } from "@/lib/server/snowflake/client";

export async function getCurrentDate(): Promise<string> {
  const rows = await executeQuery<{ current_date: string | Date }>("SELECT CURRENT_DATE AS current_date");
  if (rows.length === 0) throw new Error("Failed to get current date from Snowflake");
  const raw = rows[0].current_date;
  const result = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw);
  console.log(`Q6 current_date from Snowflake: ${result}`);
  return result;
}
