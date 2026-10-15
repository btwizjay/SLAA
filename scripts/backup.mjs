// Encrypted pg_dump backup + restore rehearsal in a disposable database.
// Requires PostgreSQL client tools matching/exceeding the server's major version.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";

const ownerUrl = process.env.DATABASE_URL_UNPOOLED;
if (!ownerUrl) throw new Error("DATABASE_URL_UNPOOLED is required; never use the runtime login for backups.");
const owner = new URL(ownerUrl);
const tools = process.env.PG_BIN ?? "";
const keyPath = process.env.BACKUP_KEY_FILE ?? path.join(homedir(), ".slaa-backup-key");
const directory = process.env.BACKUP_DIR ?? path.join(homedir(), "SLAA-backups");
const magic = Buffer.from("SLAA1");
const options = { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} };
const db = postgres(ownerUrl, options);

function pgCommand(name, database, args) {
  const executable = tools ? path.join(tools, name + (process.platform === "win32" ? ".exe" : "")) : name;
  const child = spawn(executable, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: {
    ...process.env, PGHOST: owner.hostname, PGPORT: owner.port || "5432", PGUSER: decodeURIComponent(owner.username),
    PGPASSWORD: decodeURIComponent(owner.password), PGDATABASE: database, PGSSLMODE: owner.searchParams.get("sslmode") || "require",
  } });
  // pg_restore errors can contain record data. Do not echo their text.
  let diagnostic = "";
  child.stderr.on("data", bytes => {
    if (diagnostic.length < 65536) diagnostic += bytes.toString();
  });
  child.completion = new Promise((resolve, reject) => {
    child.on("error", () => reject(new Error(`${name} could not start; check PG_BIN.`)));
    child.on("exit", code => {
      if (code === 0) return resolve();
      // Only the first ERROR line, with all quoted identifiers/values removed;
      // COPY context, SQL statements and record details are never printed.
      const reason = diagnostic.match(/ERROR:\s*([^\r\n]+)/)?.[1]
        ?.replace(/'[^']*'|"[^"]*"/g, "[redacted]").slice(0, 240);
      reject(new Error(`${name} failed (exit ${code})${reason ? ": " + reason : "; check client tools and connectivity."}`));
    });
  });
  return child;
}

function readKey(create = false) {
  if (!existsSync(keyPath) && create) {
    writeFileSync(keyPath, randomBytes(32), { flag: "wx", mode: 0o600 });
    if (process.platform === "win32") {
      const identity = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      const acl = spawnSync("icacls", [keyPath, "/inheritance:r", "/grant:r", `${identity}:(R,W)`], { windowsHide: true, stdio: "pipe" });
      if (acl.status !== 0) throw new Error("Could not restrict the backup key's Windows permissions.");
    }
  }
  const key = readFileSync(keyPath);
  if (key.length !== 32) throw new Error("Backup key must contain exactly 32 bytes.");
  return key;
}

async function inventory(sql) {
  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'slaa' ORDER BY tablename`;
  const counts = {};
  for (const { tablename } of tables) {
    const [row] = await sql`
      SELECT count(*)::int AS count,
        md5(coalesce(string_agg(row_to_json(t)::text, E'\n' ORDER BY row_to_json(t)::text), '')) AS checksum
      FROM ${sql("slaa." + tablename)} t`;
    counts[tablename] = row;
  }
  return counts;
}

async function backup() {
  const key = readKey(true);
  mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, `slaa-${new Date().toISOString().replace(/[:.]/g, "-")}.dump.aes`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  // Counts and dump share a PostgreSQL snapshot while registrations continue.
  const tables = await db.begin("isolation level repeatable read read only", async tx => {
    const [snapshot] = await tx`SELECT pg_export_snapshot() AS id`;
    const counts = await inventory(tx);
    writeFileSync(filename, Buffer.concat([magic, iv]), { flag: "wx", mode: 0o600 });
    const child = pgCommand("pg_dump", decodeURIComponent(owner.pathname.slice(1)), ["--format=custom", "--snapshot=" + snapshot.id]);
    child.stdin.end();
    await Promise.all([pipeline(child.stdout, cipher, createWriteStream(filename, { flags: "a" })), child.completion]);
    appendFileSync(filename, cipher.getAuthTag());
    return counts;
  });
  const manifest = { createdAt: new Date().toISOString(), tables,
    sha256: createHash("sha256").update(readFileSync(filename)).digest("hex") };
  writeFileSync(filename + ".json", JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ backup: filename, keyFile: keyPath, tables: Object.keys(tables).length,
    members: tables.member?.count, encrypted: "AES-256-GCM" }));
}

async function verify(filename) {
  if (!filename) throw new Error("Usage: backup.mjs verify <backup.dump.aes>");
  const key = readKey();
  const manifest = JSON.parse(readFileSync(filename + ".json", "utf8"));
  const bytes = readFileSync(filename);
  if (!bytes.subarray(0, magic.length).equals(magic)
      || createHash("sha256").update(bytes).digest("hex") !== manifest.sha256) throw new Error("Backup integrity check failed.");
  const name = `slaa_test_restore_${randomBytes(6).toString("hex")}`;
  if (!/^slaa_test_restore_[a-f0-9]{12}$/.test(name)) throw new Error("Unsafe restore target.");
  await db`CREATE DATABASE ${db(name)}`;
  const restoreUrl = new URL(ownerUrl);
  restoreUrl.pathname = "/" + name;
  const restored = postgres(restoreUrl.toString(), options);
  const temporary = mkdtempSync(path.join(tmpdir(), "slaa-restore-"));
  let report;
  function decryptedStream() {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(5, 17));
    decipher.setAuthTag(bytes.subarray(-16));
    return { source: createReadStream(filename, { start: 17, end: statSync(filename).size - 17 }), decipher };
  }
  try {
    const listing = pgCommand("pg_restore", name, ["--list"]);
    let toc = "";
    listing.stdout.on("data", chunk => { toc += chunk.toString(); });
    const listed = decryptedStream();
    await Promise.all([pipeline(listed.source, listed.decipher, listing.stdin), listing.completion]);
    // Neon includes default privileges belonging to provider-owned roles.
    // The project owner cannot alter those roles. Retain all app object ACLs,
    // including the PUBLIC execution revoke on staff deletion functions.
    let providerDefaultPrivilegesSkipped = 0;
    const list = toc.split("\n").filter(line => {
      if (line.includes(" DEFAULT ACL ") && !line.endsWith(" " + decodeURIComponent(owner.username))) {
        providerDefaultPrivilegesSkipped++;
        return false;
      }
      return true;
    }).join("\n");
    const listFile = path.join(temporary, "restore.list");
    writeFileSync(listFile, list, { mode: 0o600 });
    const child = pgCommand("pg_restore", name, ["--dbname=" + name, "--no-owner", "--exit-on-error", "--single-transaction", "--use-list=" + listFile]);
    child.stdout.resume();
    const content = decryptedStream();
    await Promise.all([
      pipeline(content.source, content.decipher, child.stdin),
      child.completion,
    ]);
    const actual = await inventory(restored);
    if (JSON.stringify(actual) !== JSON.stringify(manifest.tables)) throw new Error("Restored table counts/checksums differ from the backup snapshot.");
    const [access] = await restored`
      SELECT has_table_privilege('slaa_app', 'slaa.member', 'DELETE') AS can_delete,
        has_schema_privilege('slaa_app', 'slaa', 'CREATE') AS can_create,
        EXISTS (
          SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
            LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          WHERE n.nspname = 'slaa' AND p.proname = 'admin_delete_member'
            AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
        ) AS public_can_delete`;
    if (access.can_delete || access.can_create || access.public_can_delete) throw new Error("Restored application access rules are unsafe.");
    report = { verifiedAt: new Date().toISOString(), backup: path.basename(filename),
      tables: Object.keys(actual).length, members: actual.member?.count, checksumsMatch: true, providerDefaultPrivilegesSkipped,
      restrictedAccessVerified: true,
      restoredInto: "disposable test database", productionModified: false };
  } finally {
    try { await restored.end({ timeout: 1 }); }
    finally {
      try {
        // Always a new database whose name was generated and checked above.
        await db`DROP DATABASE ${db(name)} WITH (FORCE)`;
      } finally {
        rmSync(path.join(temporary, "restore.list"), { force: true });
        rmdirSync(temporary);
      }
    }
  }
  writeFileSync(filename + ".verified.json", JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(report));
}

try {
  if (process.argv[2] === "verify") await verify(process.argv[3]);
  else if (!process.argv[2]) await backup();
  else throw new Error("Use no arguments to back up, or verify <file> to rehearse a restore.");
} catch (e) {
  // PostgreSQL exceptions may contain source records or connection details.
  console.error(e instanceof Error && !e.code ? e.message : "Database backup operation failed; check connectivity and client versions.");
  process.exitCode = 1;
} finally { await db.end({ timeout: 1 }); }
