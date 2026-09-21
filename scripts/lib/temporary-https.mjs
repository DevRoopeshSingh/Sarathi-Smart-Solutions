import { createServer } from "node:https";
import { request } from "node:http";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Private, disposable TLS termination for testing production secure cookies. */
export async function temporaryHttps(port, upstreamPort) {
  const directory = mkdtempSync("/tmp/sarathi-ops-tls-");
  chmodSync(directory, 0o700);
  const key = join(directory, "key.pem");
  const certificate = join(directory, "cert.pem");
  let server;
  try {
    const created = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        certificate,
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
        "-addext",
        "basicConstraints=critical,CA:TRUE"
      ],
      { encoding: "utf8", timeout: 15_000 }
    );
    if (created.error || created.status !== 0)
      throw new Error("openssl could not create an ephemeral localhost certificate.");
    server = createServer(
      { key: readFileSync(key), cert: readFileSync(certificate) },
      (incoming, outgoing) => {
        const proxy = request(
          {
            hostname: "127.0.0.1",
            port: upstreamPort,
            path: incoming.url,
            method: incoming.method,
            headers: {
              ...incoming.headers,
              "x-forwarded-proto": "https",
              "x-forwarded-host": `127.0.0.1:${port}`
            }
          },
          (response) => {
            outgoing.writeHead(response.statusCode, response.headers);
            response.pipe(outgoing);
          }
        );
        proxy.on("error", () => {
          outgoing.writeHead(502);
          outgoing.end("Test server not ready.");
        });
        incoming.on("aborted", () => proxy.destroy());
        incoming.pipe(proxy);
      }
    );
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
  } catch (error) {
    server?.close();
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    certificate,
    async cleanup() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      rmSync(directory, { recursive: true, force: true });
    }
  };
}
