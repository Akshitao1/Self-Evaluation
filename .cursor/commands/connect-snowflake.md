---
description: Setup Snowflake connection with memory leak prevention
alwaysApply: false
---
# Connect Snowflake

Set up a complete Snowflake integration with SSH key authentication, read-only access, and memory leak prevention.

## 🎯 Execution Steps

### Step 1: Install Dependency
```bash
npm install snowflake-sdk
```

### Step 2: Create Configuration (`src/lib/secrets/snowflake.ts`)

Create Snowflake config that fetches credentials from AWS Secrets Manager:
- Get SSH key from `SNOWFLAKE_SSH_KEY` (required, no password auth)
- Get `SNOWFLAKE_USER`, `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_ROLE` from secrets
- Use app config/env for `SNOWFLAKE_DATABASE` and `SNOWFLAKE_SCHEMA`
- Return config with `authenticator: 'SNOWFLAKE_JWT'`

### Step 3: Create Connection Manager (`src/lib/connections/connection-manager.ts`)

Create ConnectionManager class with memory leak prevention:
- Max 10 concurrent connections
- 5 minute connection lifetime timeout
- 1 minute idle timeout
- 30 second query timeout
- Auto-cleanup interval every 30 seconds
- `register()`, `destroy()`, `cleanup()`, `getStats()` methods
- Process exit handlers for graceful shutdown

### Step 4: Create Base Connection Wrapper (`src/lib/connections/base-connection.ts`)

Create `withServiceConnection()` wrapper function:
- Check connection limit before creating
- Register connection with manager
- Execute handler with timeout
- **ALWAYS** destroy connection in finally block
- Handle unregistered connection cleanup as fallback

### Step 5: Create Snowflake Service (`src/lib/services/snowflake-service.ts`)

Create SnowflakeService class with:
- `executeQuery(sql, binds)` - Execute SELECT/WITH queries only
- `testConnection()` - Verify connection works
- `getStats()` - Return connection pool stats
- `forceCleanup()` - Manual cleanup trigger
- Enforce read-only: reject INSERT/UPDATE/DELETE/DROP
- Configure SDK with `keepAlive: false` and `clientSessionKeepAlive: false`

### Step 6: Create Query API Route (`src/app/api/snowflake/query/route.ts`)

Create API endpoints:
- `POST` - Execute parameterized SELECT query, validate SQL, return results
- `GET` - Test connection, return success/failure status

### Step 7: Create Health API Route (`src/app/api/snowflake/health/route.ts`)

Create health check endpoints:
- `GET` - Return connection stats, memory usage, warnings
- `POST` - Force cleanup of stale connections

## ✅ Verification

After setup, verify with:
```bash
# Test connection
curl http://localhost:3000/api/snowflake/query

# Check health
curl http://localhost:3000/api/snowflake/health

# Run a query
curl -X POST http://localhost:3000/api/snowflake/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT CURRENT_TIMESTAMP() as now"}'
```

## 🔒 Requirements Enforced

- **SSH key only**: No password authentication allowed
- **Read-only**: Only SELECT/WITH queries permitted
- **Memory safe**: Connection tracking, limits, auto-cleanup
- **Server-side only**: Never expose in client components
- **Parameterized queries**: Use binds array for user input

## 📋 Reference

See `@.cursor/profiles/default/rules/snowflake.mdc` for complete implementation patterns.
