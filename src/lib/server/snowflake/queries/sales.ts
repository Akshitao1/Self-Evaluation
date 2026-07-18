const FQN_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*){2}$/;

export function assertSafeSalesFqn(fqn: string): string {
  if (!FQN_PATTERN.test(fqn)) {
    throw new Error("SNOWFLAKE_SALES_FQN must look like DB.SCHEMA.OBJECT with only letters, digits, _, $.");
  }
  return fqn;
}

export function monthlyRevenueFromTableSql(fqn: string): string {
  assertSafeSalesFqn(fqn);
  return `
SELECT month_key, total_revenue
FROM ${fqn}
WHERE month_key >= %(start_date)s
  AND month_key < %(end_date)s
ORDER BY month_key
`.trim();
}

export const MONTHLY_REVENUE_DEMO = `
SELECT DATEADD(
         month,
         -ROW_NUMBER() OVER (ORDER BY SEQ4()) + 1,
         DATE_TRUNC('month', CURRENT_DATE())
       )::DATE AS month_key,
       UNIFORM(10000, 75000, RANDOM())::NUMBER(18, 2) AS total_revenue
FROM TABLE(GENERATOR(ROWCOUNT => %(months)s))
ORDER BY month_key
`.trim();
