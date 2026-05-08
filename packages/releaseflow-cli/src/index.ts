#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { Command, CommanderError } from "commander";
import {
  initializeFromEnv,
  request,
  ReleaseFlowApiError,
  ReleaseFlowConfigError,
} from "releaseflow-sdk";

type GlobalOptions = {
  json?: boolean;
};

function readNotes(pathOrDash: string): string {
  const text =
    pathOrDash === "-"
      ? readFileSync(0, "utf8")
      : readFileSync(pathOrDash, "utf8");
  return text.replace(/\s+$/, "");
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw);
}

function output(data: unknown, options: GlobalOptions): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object" && "name" in item && "slug" in item) {
        const app = item as { name: string; slug: string; id?: string };
        console.log(`${app.name} (${app.slug})${app.id ? ` ${app.id}` : ""}`);
      } else {
        console.log(JSON.stringify(item));
      }
    }
    return;
  }

  if (data && typeof data === "object") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(String(data ?? ""));
}

function handleError(error: unknown): never {
  if (error instanceof ReleaseFlowConfigError) {
    console.error(`Error: ${error.message}`);
    console.error("Set RELEASEFLOW_API_KEY, then run the command again.");
    process.exit(1);
  }

  if (error instanceof ReleaseFlowApiError) {
    console.error(`Error [${error.status}]: ${error.message}`);
    console.error(JSON.stringify(error.data, null, 2));
    process.exit(1);
  }

  if (error instanceof CommanderError) {
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unexpected error: ${message}`);
  process.exit(1);
}

function getGlobalOptions(command: Command): GlobalOptions {
  let current: Command | null = command;
  while (current) {
    const options = current.opts<GlobalOptions>();
    if (options.json) {
      return { json: true };
    }
    current = current.parent ?? null;
  }
  return {};
}

function isCommand(value: unknown): value is Command {
  return (
    value instanceof Command ||
    (typeof value === "object" &&
      value !== null &&
      "opts" in value &&
      typeof (value as { opts?: unknown }).opts === "function")
  );
}

function getCommandFromArgs(args: unknown[]): Command {
  const command = [...args].reverse().find(isCommand);
  if (!command) {
    throw new Error("Missing command context");
  }
  return command;
}

async function runAuthed(
  command: Command,
  action: (options: GlobalOptions) => Promise<unknown>,
): Promise<void> {
  initializeFromEnv();
  const globalOptions = getGlobalOptions(command);
  const data = await action(globalOptions);
  output(data, globalOptions);
}

const program = new Command("releaseflow")
  .description("CLI for ReleaseFlow apps, releases, and update feeds")
  .version("0.1.0")
  .option("--json", "Print JSON output")
  .showHelpAfterError()
  .exitOverride();

const apps = program.command("apps").description("Manage apps");

apps
  .command("list")
  .description("List apps")
  .action((...args: unknown[]) =>
    runAuthed(getCommandFromArgs(args), () => request("/apps")),
  );

apps
  .command("get")
  .argument("<slug>", "App slug")
  .description("Get an app by slug")
  .action((slug: string, ...args: unknown[]) =>
    runAuthed(getCommandFromArgs(args), () => request(`/apps/${slug}`)),
  );

apps
  .command("create")
  .argument("<name>", "App name")
  .argument("<slug>", "App slug")
  .argument("<githubRepo>", "GitHub repo as owner/repo")
  .option("--type <type>", "SPARKLE or ELECTRON", "SPARKLE")
  .description("Create an app")
  .action(
    (
      name: string,
      slug: string,
      githubRepo: string,
      options: { type: string },
      ...args: unknown[]
    ) =>
      runAuthed(getCommandFromArgs(args), () =>
        request("/apps", {
          method: "POST",
          body: JSON.stringify({ name, slug, githubRepo, type: options.type }),
        }),
      ),
  );

apps
  .command("sync")
  .argument("<appId>", "App ID")
  .description("Sync releases from GitHub")
  .action((appId: string, ...args: unknown[]) =>
    runAuthed(getCommandFromArgs(args), () =>
      request(`/apps/${appId}/sync`, {
        method: "POST",
      }),
    ),
  );

apps
  .command("urls")
  .argument("<slug>", "App slug")
  .description("Get download and update URLs")
  .action((slug: string, ...args: unknown[]) =>
    runAuthed(getCommandFromArgs(args), () => request(`/apps/${slug}/urls`)),
  );

const releases = program.command("releases").description("Manage releases");

releases
  .command("update")
  .argument("<releaseId>", "Release ID")
  .requiredOption("--notes <file>", "Notes file, or - for stdin")
  .option("--changelog-url <url>", "Custom changelog URL, or null to clear")
  .option("--enable", "Enable the release")
  .option("--disable", "Disable the release")
  .description("Update release notes, changelog URL, or enabled state")
  .action(
    (
      releaseId: string,
      options: {
        notes: string;
        changelogUrl?: string;
        enable?: boolean;
        disable?: boolean;
      },
      ...args: unknown[]
    ) =>
      runAuthed(getCommandFromArgs(args), () => {
        const body: Record<string, unknown> = {
          notes: readNotes(options.notes),
        };

        if (options.changelogUrl !== undefined) {
          body.changelogUrl =
            options.changelogUrl === "null" ? null : options.changelogUrl;
        }

        if (options.enable) {
          body.isEnabled = true;
        }
        if (options.disable) {
          body.isEnabled = false;
        }

        return request(`/releases/${releaseId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }),
  );

releases
  .command("toggle")
  .argument("<releaseId>", "Release ID")
  .description("Toggle release availability")
  .action((releaseId: string, ...args: unknown[]) =>
    runAuthed(getCommandFromArgs(args), () =>
      request(`/releases/${releaseId}/toggle`, {
        method: "POST",
      }),
    ),
  );

releases
  .command("delete")
  .argument("<releaseId>", "Release ID")
  .option("--force", "Confirm deletion")
  .description("Delete a release from ReleaseFlow only")
  .action(
    (
      releaseId: string,
      options: {
        force?: boolean;
      },
      ...args: unknown[]
    ) => {
      if (!options.force) {
        throw new Error("Refusing to delete without --force");
      }
      return runAuthed(getCommandFromArgs(args), () =>
        request(`/releases/${releaseId}`, {
          method: "DELETE",
        }),
      );
    },
  );

program
  .command("request")
  .argument("<method>", "HTTP method")
  .argument("<path>", "API path, for example /apps")
  .argument("[json]", "Optional JSON body")
  .description("Make a raw ReleaseFlow REST request")
  .action((method: string, path: string, ...args: unknown[]) => {
    const command = getCommandFromArgs(args);
    const rawBody = args.find((arg): arg is string => typeof arg === "string");

    return runAuthed(command, () =>
      request(path, {
        method: method.toUpperCase(),
        body: rawBody ? JSON.stringify(parseJson(rawBody)) : undefined,
      }),
    );
  });

program.parseAsync(process.argv).catch(handleError);
