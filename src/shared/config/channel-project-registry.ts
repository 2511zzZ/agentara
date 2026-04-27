import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { resolveProjectMetaPath } from "./paths";

import { config } from ".";

const channelToProject = new Map<string, string>();
const projectToChannel = new Map<string, string>();

let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;

  for (const ch of config.messaging.channels) {
    if (!ch.project) continue;
    channelToProject.set(ch.id, ch.project);
    projectToChannel.set(ch.project, ch.id);
  }
}

export function resetRegistry(): void {
  channelToProject.clear();
  projectToChannel.clear();
  initialized = false;
}

export function resolveProjectForChannel(
  channelId: string,
): string | undefined {
  ensureInit();
  return channelToProject.get(channelId);
}

export function resolveChannelForProject(
  projectName: string,
): string | undefined {
  ensureInit();
  return projectToChannel.get(projectName);
}

export function resolveProjectCwd(projectName: string): string | undefined {
  const metaPath = resolveProjectMetaPath(projectName);
  if (!existsSync(metaPath)) return undefined;
  try {
    const raw = Bun.YAML.parse(readFileSync(metaPath, "utf-8")) as {
      repo?: string;
    };
    if (!raw.repo) return undefined;
    const expanded = raw.repo.replace(/^~/, homedir());
    return resolve(expanded);
  } catch {
    return undefined;
  }
}
