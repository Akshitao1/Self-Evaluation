import "server-only";
import { getSecret } from "@/lib/secrets-manager";

const PLACEHOLDERS: Record<string, string> = {
  SNOWFLAKE_USER: "your_user",
  SNOWFLAKE_ACCOUNT: "your_account",
  SNOWFLAKE_PASSWORD: "your_password",
};

function blankOrPlaceholder(value: string | undefined | null, placeholder?: string): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (placeholder && trimmed.toLowerCase() === placeholder.toLowerCase()) return null;
  return trimmed;
}

export async function pick(awsKey: string, ...envFallbacks: (string | undefined | null)[]): Promise<string | null> {
  const fromAws = await getSecret(awsKey);
  const placeholder = PLACEHOLDERS[awsKey];
  const cleanedAws = blankOrPlaceholder(fromAws, placeholder);
  if (cleanedAws) return cleanedAws;

  for (const v of envFallbacks) {
    const cleaned = blankOrPlaceholder(v, placeholder);
    if (cleaned) return cleaned;
  }
  return null;
}

export interface ResolvedSettings {
  snowflake: {
    user: string | null;
    account: string | null;
    warehouse: string | null;
    database: string | null;
    schema: string | null;
    role: string | null;
    sshKey: string | null;
    password: string | null;
    salesFqn: string | null;
  };
  postgresUrl: string;
  apiBaseUrl: string;
  apiAuthToken: string;
}

let cached: ResolvedSettings | null = null;

export async function getSettings(): Promise<ResolvedSettings> {
  if (cached) return cached;

  const [
    user,
    account,
    warehouse,
    database,
    schema,
    role,
    sshKey,
    password,
    salesFqn,
    postgresUrl,
    apiBaseUrl,
    apiAuthToken,
  ] = await Promise.all([
    pick("SNOWFLAKE_USER", process.env.SNOWFLAKE_USER),
    pick("SNOWFLAKE_ACCOUNT", process.env.SNOWFLAKE_ACCOUNT),
    pick("SNOWFLAKE_WAREHOUSE", process.env.SNOWFLAKE_WAREHOUSE),
    pick("SNOWFLAKE_DATABASE", process.env.SNOWFLAKE_DATABASE),
    pick("SNOWFLAKE_SCHEMA", process.env.SNOWFLAKE_SCHEMA),
    pick("SNOWFLAKE_ROLE", process.env.SNOWFLAKE_ROLE),
    pick("SNOWFLAKE_SSH_KEY", process.env.SNOWFLAKE_SSH_KEY, process.env.SNOWFLAKE_PRIVATE_KEY_PEM),
    pick("SNOWFLAKE_PASSWORD", process.env.SNOWFLAKE_PASSWORD),
    pick("SNOWFLAKE_SALES_FQN", process.env.SNOWFLAKE_SALES_FQN),
    pick("POSTGRES_URL", process.env.POSTGRES_URL, process.env.DATABASE_URL),
    pick("API_BASE_URL", process.env.API_BASE_URL),
    pick("API_AUTH_TOKEN", process.env.API_AUTH_TOKEN),
  ]);

  cached = {
    snowflake: {
      user,
      account,
      warehouse,
      database,
      schema,
      role,
      sshKey,
      password,
      salesFqn,
    },
    postgresUrl: postgresUrl ?? "postgresql://postgres:postgres@localhost:5432/postgres",
    apiBaseUrl: apiBaseUrl ?? "https://your-api-base-url.com",
    apiAuthToken: apiAuthToken ?? "",
  };
  return cached;
}

export function clearSettingsCache(): void {
  cached = null;
}
