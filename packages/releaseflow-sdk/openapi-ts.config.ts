import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://releaseflow.net/api/openapi.json?public=1",
  output: {
    path: "src/client",
    format: "prettier",
  },
  client: {
    baseUrl: "https://releaseflow.net/api/rest",
  },
  plugins: [
    "@hey-api/typescript",
    {
      name: "@hey-api/sdk",
      asClass: true,
    },
  ],
});
