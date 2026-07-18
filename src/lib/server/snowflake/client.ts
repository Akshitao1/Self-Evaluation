import "server-only";
import snowflake, { Connection } from "snowflake-sdk";
import { getSettings } from "@/lib/server/settings";

const ESCAPED_NEWLINE_RE = /\\+n/g;

function normalizePem(raw: string): string {
  return raw.replace(ESCAPED_NEWLINE_RE, "\n").trim();
}

function stripAccountSuffix(account: string): string {
  return account.toLowerCase().endsWith(".snowflakecomputing.com")
    ? account.slice(0, -".snowflakecomputing.com".length)
    : account;
}

let conn: Connection | null = null;
let connectPromise: Promise<Connection> | null = null;

async function buildConnectOptions(): Promise<snowflake.ConnectionOptions> {
  const { snowflake: s } = await getSettings();
  if (!s.user || !s.account) {
    throw new Error(
      "Snowflake user and account are required. Configure SECRET_NAME with SNOWFLAKE_USER/SNOWFLAKE_ACCOUNT, " +
        "or set them in the environment.",
    );
  }
  const account = stripAccountSuffix(s.account);

  const opts: snowflake.ConnectionOptions = {
    account,
    username: s.user,
  };
  if (s.warehouse) opts.warehouse = s.warehouse;
  if (s.database) opts.database = s.database;
  if (s.schema) opts.schema = s.schema;
  if (s.role) opts.role = s.role;

  if (s.sshKey) {
    opts.authenticator = "SNOWFLAKE_JWT";
    opts.privateKey = normalizePem(s.sshKey);
  } else if (s.password) {
    opts.password = s.password;
  } else {
    throw new Error(
      "Provide JWT key PEM (SNOWFLAKE_SSH_KEY or SNOWFLAKE_PRIVATE_KEY_PEM) or SNOWFLAKE_PASSWORD.",
    );
  }
  return opts;
}

export async function getConnection(): Promise<Connection> {
  if (conn?.isUp()) return conn;
  if (connectPromise) return connectPromise;

  const opts = await buildConnectOptions();
  const c = snowflake.createConnection(opts);
  connectPromise = new Promise<Connection>((resolve, reject) => {
    c.connect((err, connection) => {
      if (err) {
        connectPromise = null;
        reject(err);
        return;
      }
      conn = connection;
      connectPromise = null;
      resolve(connection);
    });
  });
  return connectPromise;
}

export async function closeConnection(): Promise<void> {
  if (!conn) return;
  await new Promise<void>((resolve) => {
    conn!.destroy((err) => {
      if (err) console.error("Error closing Snowflake connection:", err);
      resolve();
    });
  });
  conn = null;
}

/**
 * Translates Python pyformat `%(name)s` placeholders to snowflake-sdk positional `?` binds.
 * Same name reused in the SQL becomes multiple binds (matches snowflake driver semantics).
 */
function translateBinds(sql: string, params?: Record<string, unknown>): { text: string; binds: unknown[] } {
  if (!params) return { text: sql, binds: [] };
  const binds: unknown[] = [];
  const text = sql.replace(/%\((\w+)\)s/g, (_match, key: string) => {
    if (!(key in params)) {
      throw new Error(`Missing Snowflake bind parameter: ${key}`);
    }
    binds.push(params[key]);
    return "?";
  });
  return { text, binds };
}

export async function executeQuery<T = Record<string, unknown>>(
  sql: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const connection = await getConnection();
  const { text, binds } = translateBinds(sql, params);

  const preview = text.replace(/\s+/g, " ").trim().slice(0, 200);
  const t0 = Date.now();
  console.log(`SQL >>> ${preview}`);
  if (binds.length) console.log(`PARAMS >>> ${JSON.stringify(binds)}`);

  return new Promise<T[]>((resolve, reject) => {
    connection.execute({
      sqlText: text,
      binds: binds as snowflake.Bind[],
      complete: (err, _stmt, rows) => {
        if (err) {
          console.error("Snowflake error:", err);
          reject(err);
          return;
        }
        const elapsed = Date.now() - t0;
        const result = (rows ?? []).map((row) => lowercaseKeys(row as Record<string, unknown>)) as T[];
        console.log(`Query executed in ${elapsed} ms — ${result.length} row(s) returned.`);
        resolve(result);
      },
    });
  });
}

function lowercaseKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) out[k.toLowerCase()] = row[k];
  return out;
}

export async function snowflakeConnectionConfigured(): Promise<{ ok: boolean; reason?: string }> {
  const { snowflake: s } = await getSettings();
  if (!s.user || !s.account)
    return { ok: false, reason: "missing SNOWFLAKE_USER/SNOWFLAKE_ACCOUNT (AWS secret or environment)" };
  if (!s.sshKey && !s.password)
    return { ok: false, reason: "missing auth (SNOWFLAKE_SSH_KEY/SNOWFLAKE_PRIVATE_KEY_PEM or SNOWFLAKE_PASSWORD)" };
  return { ok: true };
}
