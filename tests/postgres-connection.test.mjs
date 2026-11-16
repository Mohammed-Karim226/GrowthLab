import assert from "node:assert/strict";
import { once } from "node:events";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect as netConnect, createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { createSecureContext, connect as tlsConnect, TLSSocket } from "node:tls";
import { test } from "node:test";
import pg from "pg";
import { postgresConnectionOptions } from "../scripts/lib/postgres-connection.mjs";

const certPath = fileURLToPath(new URL("./fixtures/postgres-tls/cert.pem", import.meta.url));
const keyPath = fileURLToPath(new URL("./fixtures/postgres-tls/key.pem", import.meta.url));
const cert = readFileSync(certPath, "utf8");
const key = readFileSync(keyPath, "utf8");
const certificate = new X509Certificate(cert).toLegacyObject();
const remoteUrl = "postgres://operator:synthetic-password@db.example.invalid/reports";
const options = (url, extra = {}) => postgresConnectionOptions(url, { caFile: "", ...extra });

test("ordinary PostgreSQL URLs preserve decoded fields and enforce verification", () => {
  for (const scheme of ["postgres", "postgresql"]) {
    const config = options(`${scheme}://operator%40agency:p%40ss%3Aword@db.example.invalid:5433/report%20data?application_name=audit&options=-c%20statement_timeout%3D1000&pgbouncer=true`);
    const client = new pg.Client(config);
    assert.equal(client.user, "operator@agency");
    assert.equal(client.password, "p@ss:word");
    assert.equal(client.database, "report data");
    assert.equal(client.port, 5433);
    assert.equal(client.connectionParameters.application_name, "audit");
    assert.equal(client.connectionParameters.options, "-c statement_timeout=1000");
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(client.connectionParameters.ssl.sslmode, "verify-full");
    assert.equal(config.connectionString, undefined);
    assert.equal(config.pgbouncer, undefined);
  }
});

test("credentialed URLs with an omitted authority host retain pg compatibility", () => {
  for (const scheme of ["postgres", "postgresql"]) {
    const client = new pg.Client(options(`${scheme}://operator:synthetic-password@/reports?host=db.example.invalid`));
    assert.equal(client.host, "db.example.invalid");
    assert.equal(client.user, "operator");
    assert.equal(client.password, "synthetic-password");
    assert.equal(client.database, "reports");
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  }
});

for (const query of ["ssl=0", "ssl=no-verify", "sslmode=disable", "sslmode=no-verify", "%73slmode=disable", "sslmode=verify-full&sslmode=disable"]) {
  test(`remote URL cannot disable TLS with ${query}`, () => {
    assert.throws(() => options(`${remoteUrl}?${query}`), /require verified TLS/);
  });
}

for (const mode of ["require", "prefer", "verify-ca", "verify-full"]) {
  test(`TLS mode ${mode} keeps certificate and hostname verification with either parser semantics`, () => {
    for (const compat of ["false", "true"]) {
      const url = new URL(remoteUrl);
      url.searchParams.set("sslmode", mode);
      url.searchParams.set("uselibpqcompat", compat);
      url.searchParams.set("sslrootcert", certPath);
      const client = new pg.Client(options(url.toString()));
      assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
      assert.equal(client.connectionParameters.ssl.sslmode, "verify-full");
      assert.equal(client.connectionParameters.ssl.checkServerIdentity("localhost", certificate).code, "ERR_TLS_CERT_ALTNAME_INVALID");
      assert.equal(client.connectionParameters.ssl.ca, cert);
    }
  });
}

for (const field of ["connectionString", "nativeConnectionString", "connection", "stream", "%63onnectionString"]) {
  test(`URL client control ${field} cannot replace the verified configuration`, () => {
    const nested = encodeURIComponent("postgres://operator:synthetic-password@attacker.invalid/reports?sslmode=disable");
    assert.throws(() => options(`${remoteUrl}?${field}=${nested}`), /unsupported client-control/);
  });
}

test("localhost exception uses the final parsed host, including IPv6 and query aliases", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    assert.equal(options(`postgres://operator:synthetic-password@${host}/reports`).ssl.rejectUnauthorized, true);
    assert.equal(options(`postgres://operator:synthetic-password@${host}/reports`, { allowLocalPlaintext: true }).ssl, false);
  }
  assert.equal(options(`${remoteUrl}?host=%3A%3A1`, { allowLocalPlaintext: true }).ssl, false);
  for (const query of ["host=db.example.invalid", "host=localhost&host=db.example.invalid", "%68ost=db.example.invalid"]) {
    const config = options(`postgres://operator:synthetic-password@localhost/reports?${query}`, { allowLocalPlaintext: true });
    const client = new pg.Client(config);
    assert.equal(client.host, "db.example.invalid");
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  }
  assert.equal(options(`${remoteUrl}?host=localhost.attacker.invalid`, { allowLocalPlaintext: true }).ssl.rejectUnauthorized, true);
  assert.throws(() => options("postgres://operator:synthetic-password@localhost/reports?host=db.example.invalid&sslmode=disable", { allowLocalPlaintext: true }), /require verified TLS/);
  assert.equal(options("postgres://operator:synthetic-password@localhost/reports?sslmode=verify-full", { allowLocalPlaintext: true }).ssl.rejectUnauthorized, true);
});

test("query host/port/user precedence and caller timeouts are preserved", () => {
  const client = new pg.Client({
    ...options(`${remoteUrl}?host=db.projectref.supabase.co&port=6543&user=postgres.projectref&statement_timeout=1`),
    statement_timeout: 300_000,
    connectionTimeoutMillis: 10_000,
  });
  assert.equal(client.host, "db.projectref.supabase.co");
  assert.equal(client.user, "postgres.projectref");
  assert.equal(client.port, 6543);
  assert.equal(client.connectionParameters.statement_timeout, 300_000);
  assert.equal(client.connectionParameters.connect_timeout, 10);
});

test("CA and client certificate/key files survive without inheriting parser callbacks", () => {
  const url = new URL(remoteUrl);
  url.searchParams.set("sslrootcert", certPath);
  url.searchParams.set("sslcert", certPath);
  url.searchParams.set("sslkey", keyPath);
  const config = options(url.toString(), { caFile: "nonexistent-ca-must-not-override-url.pem" });
  assert.equal(config.ssl.ca, cert);
  assert.equal(config.ssl.cert, cert);
  assert.equal(config.ssl.key, key);
  assert.equal(config.ssl.sslrootcert, certPath);
  assert.equal(config.ssl.sslcert, certPath);
  assert.equal(config.ssl.sslkey, keyPath);
  assert.equal(options(remoteUrl, { caFile: certPath }).ssl.ca, cert);
});

test("PGSSLROOTCERT supplies the CA and PGSSLMODE cannot weaken remote settings", async (t) => {
  const previousCa = process.env.PGSSLROOTCERT;
  const previousMode = process.env.PGSSLMODE;
  t.after(() => {
    if (previousCa === undefined) delete process.env.PGSSLROOTCERT;
    else process.env.PGSSLROOTCERT = previousCa;
    if (previousMode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previousMode;
  });
  process.env.PGSSLROOTCERT = certPath;
  process.env.PGSSLMODE = "disable";
  const config = postgresConnectionOptions("postgres://operator:synthetic-password@127.0.0.1/reports");
  const client = new pg.Client(config);
  assert.equal(client.connectionParameters.ssl.ca, cert);
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  const nativeString = await new Promise((resolve, reject) => client.connectionParameters.getLibpqConnectionString((error, value) => error ? reject(error) : resolve(value)));
  assert.match(nativeString, /sslmode='verify-full'/);
  assert.match(nativeString, /sslrootcert='/);
});

test("configuration errors omit supplied credentials", () => {
  for (const url of ["https://operator:secret-to-hide@db.example.invalid/reports", `${remoteUrl}?sslrootcert=nonexistent-ca.pem`, `${remoteUrl}?connectionString=secret-to-hide`]) {
    assert.throws(() => options(url), (error) => {
      assert.doesNotMatch(error.message, /secret-to-hide|synthetic-password|postgres:\/\//);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test("an omitted URL host uses PGHOST for both transport and certificate identity", (t) => {
  const previousHost = process.env.PGHOST;
  t.after(() => {
    if (previousHost === undefined) delete process.env.PGHOST;
    else process.env.PGHOST = previousHost;
  });
  process.env.PGHOST = "127.0.0.2";
  const config = options("postgres:///reports", { allowLocalPlaintext: true });
  const client = new pg.Client(config);
  assert.equal(client.host, "127.0.0.2");
  assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.checkServerIdentity("localhost", certificate).code, "ERR_TLS_CERT_ALTNAME_INVALID");
});

// A synthetic PostgreSQL handshake over loopback. It has no database or business data.
async function postgresTlsServer(t, host = "127.0.0.1") {
  const context = createSecureContext({ cert, key });
  const sockets = new Set();
  const state = { passwords: [], startupPackets: 0 };
  const auth = (code) => {
    const message = Buffer.alloc(9);
    message.write("R");
    message.writeInt32BE(8, 1);
    message.writeInt32BE(code, 5);
    return message;
  };
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    let request = Buffer.alloc(0);
    function acceptSsl(chunk) {
      request = Buffer.concat([request, chunk]);
      if (request.length < 8) return;
      if (request.readInt32BE(4) !== 80877103) return socket.destroy();
      socket.removeListener("data", acceptSsl);
      socket.pause();
      socket.write("S");
      const secure = new TLSSocket(socket, { isServer: true, secureContext: context });
      sockets.add(secure);
      secure.on("error", () => {});
      secure.on("close", () => sockets.delete(secure));
      let buffer = Buffer.alloc(0);
      let started = false;
      secure.on("data", (data) => {
        buffer = Buffer.concat([buffer, data]);
        if (!started) {
          if (buffer.length < 4 || buffer.length < buffer.readInt32BE(0)) return;
          buffer = buffer.subarray(buffer.readInt32BE(0));
          started = true;
          state.startupPackets++;
          secure.write(auth(3));
        }
        while (buffer.length >= 5) {
          const length = buffer.readInt32BE(1) + 1;
          if (buffer.length < length) return;
          const type = String.fromCharCode(buffer[0]);
          if (type === "p") {
            state.passwords.push(buffer.subarray(5, length - 1).toString());
            secure.write(Buffer.concat([auth(0), Buffer.from([90, 0, 0, 0, 5, 73])]));
          } else if (type === "X") secure.end();
          buffer = buffer.subarray(length);
        }
      });
      socket.resume();
    }
    socket.on("data", acceptSsl);
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });
  return { port: server.address().port, state };
}

test("previous insecure TLS lets a synthetic impersonator request the password", { timeout: 5000 }, async (t) => {
  const { port, state } = await postgresTlsServer(t);
  const client = new pg.Client({ connectionString: `postgres://operator:synthetic-password@127.0.0.1:${port}/reports`, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 2000 });
  t.after(() => client.end().catch(() => {}));
  await client.connect();
  assert.deepEqual(state.passwords, ["synthetic-password"]);
  await client.end();
});

test("fixed pg connection rejects an untrusted certificate before authentication", { timeout: 5000 }, async (t) => {
  const { port, state } = await postgresTlsServer(t);
  const client = new pg.Client({ ...options(`postgres://operator:synthetic-password@127.0.0.1:${port}/reports`), connectionTimeoutMillis: 2000 });
  t.after(() => client.end().catch(() => {}));
  await assert.rejects(client.connect(), (error) => ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN"].includes(error.code));
  assert.equal(state.startupPackets, 0);
  assert.deepEqual(state.passwords, []);
});

test("fixed pg connection accepts the trusted CA through the same handshake", { timeout: 5000 }, async (t) => {
  const { port, state } = await postgresTlsServer(t);
  const client = new pg.Client({ ...options(`postgres://operator:synthetic-password@127.0.0.1:${port}/reports`, { caFile: certPath }), connectionTimeoutMillis: 2000 });
  t.after(() => client.end().catch(() => {}));
  await client.connect();
  assert.equal(state.startupPackets, 1);
  assert.deepEqual(state.passwords, ["synthetic-password"]);
  await client.end();
});

test("a trusted certificate for another hostname is rejected", { timeout: 5000 }, async (t) => {
  const { port, state } = await postgresTlsServer(t);
  const config = options(remoteUrl, { caFile: certPath });
  const transport = netConnect({ host: "127.0.0.1", port });
  t.after(() => transport.destroy());
  await once(transport, "connect");
  transport.write(Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]));
  const [response] = await once(transport, "data");
  assert.equal(response.toString(), "S");
  const socket = tlsConnect({ ...config.ssl, socket: transport, servername: "different.example.invalid" });
  t.after(() => socket.destroy());
  await assert.rejects(new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  }), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
  assert.deepEqual(state.passwords, []);
});

test("pg verifies the actual IP instead of falling back to localhost", { timeout: 5000 }, async (t) => {
  const { port, state } = await postgresTlsServer(t, "127.0.0.2");
  const client = new pg.Client({ ...options(`postgres://operator:synthetic-password@127.0.0.2:${port}/reports`, { caFile: certPath }), connectionTimeoutMillis: 2000 });
  t.after(() => client.end().catch(() => {}));
  await assert.rejects(client.connect(), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
  assert.equal(state.startupPackets, 0);
  assert.deepEqual(state.passwords, []);
});
