import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface ProjectMeta {
  name: string;
  description: string;
  repo?: string;
  status: string;
  tags: string[];
}

export interface ScanOptions {
  status?: string;
}

export async function readProjectMeta(projectDir: string): Promise<ProjectMeta | null> {
  const metaPath = join(projectDir, "meta.yaml");
  if (!existsSync(metaPath)) return null;
  try {
    const content = await Bun.file(metaPath).text();
    const parsed = parseYaml(content);
    return {
      name: parsed.name,
      description: parsed.description ?? "",
      repo: parsed.repo,
      status: parsed.status ?? "active",
      tags: parsed.tags ?? [],
    };
  } catch {
    return null;
  }
}

export async function scanProjects(registryDir: string, options?: ScanOptions): Promise<ProjectMeta[]> {
  if (!existsSync(registryDir)) return [];
  const entries = readdirSync(registryDir, { withFileTypes: true });
  const projects: ProjectMeta[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readProjectMeta(join(registryDir, entry.name));
    if (!meta) continue;
    if (options?.status && meta.status !== options.status) continue;
    projects.push(meta);
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}
