import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

/** A new private socket-only cluster. Never connects to DATABASE_URL or an existing server. */
export function temporaryPostgres() {
  const required = ["initdb", "pg_ctl", "psql"];
  const candidates = [process.env.PG_BINDIR, "/opt/homebrew/opt/postgresql@18/bin"];
  const pgConfig = spawnSync("pg_config", ["--bindir"], { encoding: "utf8" });
  if (pgConfig.status === 0) candidates.push(pgConfig.stdout.trim());
  const bin = candidates.find(
    (candidate) => candidate && required.every((name) => existsSync(join(candidate, name)))
  );
  if (!bin)
    throw new Error("PostgreSQL server binaries required; set PG_BINDIR. No database tests ran.");
  const directory = mkdtempSync("/tmp/sarathi-ops-pg-");
  chmodSync(directory, 0o700);
  const data = join(directory, "data");
  let initialized = false;
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("PG") && !key.startsWith("DATABASE_")
    )
  );
  function command(binary, args, allowFailure = false) {
    const result = spawnSync(join(bin, binary), args, {
      env: environment,
      encoding: "utf8",
      timeout: 60_000
    });
    if (result.error) throw result.error;
    if (!allowFailure && result.status !== 0) throw new Error(`${binary} failed: ${result.stderr}`);
    return result;
  }
  function cleanup() {
    if (initialized && existsSync(join(data, "postmaster.pid"))) {
      const stopped = command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], true);
      if (stopped.status !== 0 && existsSync(join(data, "postmaster.pid")))
        throw new Error(`Could not stop temporary PostgreSQL. Retained ${directory} for cleanup.`);
    }
    rmSync(directory, { recursive: true, force: true });
  }
  try {
    command("initdb", [
      "-D",
      data,
      "-U",
      "sarathi_test",
      "--auth-local=trust",
      "--auth-host=reject",
      "--no-locale",
      "--encoding=UTF8"
    ]);
    initialized = true;
    command("pg_ctl", [
      "-D",
      data,
      "-l",
      join(directory, "postgres.log"),
      "-o",
      `-c listen_addresses='' -c unix_socket_directories='${directory}' -c unix_socket_permissions=0700`,
      "-w",
      "start"
    ]);
  } catch (error) {
    cleanup();
    throw error;
  }
  return {
    cleanup,
    applyRuntimeGrants(path) {
      command("psql", [
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "runtime_role=sarathi_runtime_test",
        "-h",
        directory,
        "-U",
        "sarathi_test",
        "-d",
        "postgres",
        "-f",
        path
      ]);
    },
    connectionString: `postgresql://sarathi_test@localhost/postgres?host=${encodeURIComponent(directory)}`
  };
}
