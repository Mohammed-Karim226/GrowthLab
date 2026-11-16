import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import { parse } from "pg-connection-string";

const connectionFields = [
  "host", "port", "user", "password", "database", "options", "client_encoding",
  "application_name", "fallback_application_name", "replication", "binary",
  "statement_timeout", "lock_timeout", "idle_in_transaction_session_timeout",
  "query_timeout", "connectionTimeoutMillis", "keepAlive", "keepAliveInitialDelayMillis",
];
const clientControls = new Set(["connectionString", "nativeConnectionString", "connection", "stream"]);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

/** Parse once so pg cannot replace the verified TLS settings from URL parameters. */
export function postgresConnectionOptions(connectionString, {
  allowLocalPlaintext = false,
  caFile = process.env.PGSSLROOTCERT,
} = {}) {
  let parsed;
  try {
    if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new Error();
    // pg also supports credentialed URLs with an omitted authority host.
    parsed = parse(connectionString);
    if (Object.keys(parsed).some((key) => clientControls.has(key))) throw new Error();
  } catch {
    // Parser errors can contain the URL or certificate paths; never echo credentials.
    throw new Error("Invalid PostgreSQL connection configuration. Check the URL, TLS certificate paths, and unsupported client-control parameters.");
  }

  const config = Object.fromEntries(connectionFields
    .filter((key) => parsed[key] !== undefined && parsed[key] !== null)
    .map((key) => [key, parsed[key]]));
  config.host ||= process.env.PGHOST || "localhost";
  if (config.host?.startsWith("[") && config.host.endsWith("]") && isIP(config.host.slice(1, -1))) {
    config.host = config.host.slice(1, -1);
  }
  const localPlaintext = allowLocalPlaintext && localHosts.has(config.host?.toLowerCase())
    && (parsed.ssl === undefined || parsed.ssl === false);
  if (localPlaintext) return { ...config, ssl: false };

  if (parsed.ssl === false || parsed.ssl === "no-verify" || ["disable", "no-verify"].includes(parsed.sslmode)) {
    throw new Error("PostgreSQL connections require verified TLS. Remove ssl=0, ssl=no-verify, or sslmode=disable/no-verify from the connection URL.");
  }

  // Copy only certificate material, never a parsed checkServerIdentity callback.
  // The libpq fields also enforce verification if pg's optional native client is used.
  const ssl = {
    rejectUnauthorized: true,
    sslmode: "verify-full",
    // pg 8 omits SNI for IP literals; Node can then fall back to "localhost".
    // Bind identity verification to the same host that pg will connect to.
    checkServerIdentity: (_servername, certificate) => checkServerIdentity(config.host, certificate),
  };
  for (const [field, pathField] of [["ca", "sslrootcert"], ["cert", "sslcert"], ["key", "sslkey"]]) {
    if (parsed.ssl?.[field]) ssl[field] = parsed.ssl[field];
    if (parsed[pathField]) ssl[pathField] = parsed[pathField];
  }
  if (!ssl.ca && caFile) {
    try {
      ssl.ca = readFileSync(caFile, "utf8");
      ssl.sslrootcert = caFile;
    } catch {
      throw new Error("Unable to read the PostgreSQL CA certificate. Check PGSSLROOTCERT.");
    }
  }
  return { ...config, ssl };
}
