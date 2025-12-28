import https from "node:https";

/**
 * An HTTPS agent configured with Chrome-like TLS settings.
 * This helps bypass TLS fingerprinting that some APIs use to block
 * non-browser requests (e.g., Epic Games API blocks Node 24's default fingerprint).
 */
const browserTlsAgent = new https.Agent({
  // Chrome-like cipher suite order
  ciphers: [
    "TLS_AES_128_GCM_SHA256",
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "ECDHE-ECDSA-AES128-GCM-SHA256",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-ECDSA-AES256-GCM-SHA384",
    "ECDHE-RSA-AES256-GCM-SHA384",
  ].join(":"),
  ecdhCurve: "X25519:P-256:P-384",
  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.3",
});

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: <T>() => Promise<T>;
  text: () => Promise<string>;
}

/**
 * A fetch-like function that uses Chrome-like TLS settings to bypass
 * TLS fingerprinting. Use this when the standard fetch() gets blocked
 * with 403 errors due to TLS fingerprinting.
 * @param url - The URL to fetch (must be HTTPS)
 * @param options - Fetch options (method, headers)
 * @returns A response object with ok, status, json(), and text() methods
 */
export function fetchWithBrowserTls(
  url: string,
  options: FetchOptions = {},
): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    if (urlObj.protocol !== "https:") {
      reject(new Error("fetchWithBrowserTls only supports HTTPS URLs"));
      return;
    }

    const reqOptions: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method ?? "GET",
      headers: options.headers ?? {},
      agent: browserTlsAgent,
    };

    const req = https.request(reqOptions, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => chunks.push(chunk));

      res.on("end", () => {
        const data = Buffer.concat(chunks).toString("utf-8");
        const status = res.statusCode ?? 0;

        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: res.statusMessage ?? "",
          json: <T>() => Promise.resolve(JSON.parse(data) as T),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}
