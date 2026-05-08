export * from "./client/index.js";

import { client } from "./client/client.gen.js";

export interface ReleaseFlowConfig {
  apiKey: string;
  baseUrl?: string;
}

export class ReleaseFlowConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseFlowConfigError";
  }
}

export class ReleaseFlowApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(message);
    this.name = "ReleaseFlowApiError";
  }
}

let config: Required<ReleaseFlowConfig> | null = null;

export function configure(options: ReleaseFlowConfig): Required<ReleaseFlowConfig> {
  const nextConfig = {
    apiKey: options.apiKey,
    baseUrl: options.baseUrl ?? "https://releaseflow.net/api/rest",
  };

  client.setConfig({
    baseUrl: nextConfig.baseUrl,
    headers: {
      "x-api-key": nextConfig.apiKey,
    },
  });

  config = nextConfig;
  return nextConfig;
}

export function initializeFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Required<ReleaseFlowConfig> {
  const apiKey = env.RELEASEFLOW_API_KEY;
  if (!apiKey) {
    throw new ReleaseFlowConfigError("Missing RELEASEFLOW_API_KEY");
  }

  return configure({
    apiKey,
    baseUrl: env.RELEASEFLOW_BASE_URL,
  });
}

function getConfig(): Required<ReleaseFlowConfig> {
  if (config) {
    return config;
  }
  return initializeFromEnv();
}

function parseResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const activeConfig = getConfig();
  const headers = new Headers(init.headers);
  headers.set("x-api-key", activeConfig.apiKey);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${activeConfig.baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const data = parseResponseBody(text);

  if (!response.ok) {
    throw new ReleaseFlowApiError(
      `ReleaseFlow API request failed with ${response.status}`,
      response.status,
      data,
    );
  }

  return data as T;
}

export { client };
