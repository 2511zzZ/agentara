import { readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import dayjs from "dayjs";

export interface TaskRecord {
  title: string;
  status: string;
  created: string;
  updated: string;
  workflow: string[];
  session_ids: string[];
  instruction: string;
  filePath: string;
  body: string;
}

export interface CreateTaskOptions {
  title: string;
  instruction: string;
  workflow: string[];
}

export interface ListTasksOptions {
  status?: string;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildTaskContent(frontmatter: Record<string, unknown>, instruction: string, body: string): string {
  return `---\n${stringifyYaml(frontmatter).trim()}\n---\n\n## Instruction\n\n${instruction}\n${body}`;
}

function parseTaskContent(content: string, filePath: string): TaskRecord | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch?.[1] || fmMatch[2] === undefined) return null;
  const fm = parseYaml(fmMatch[1]) as Record<string, unknown>;
  const bodyContent = fmMatch[2];
  const instrMatch = bodyContent.match(/## Instruction\n\n([\s\S]*?)(?=\n## |\n*$)/);
  const instruction = instrMatch?.[1]?.trim() ?? "";
  const bodyAfterInstruction = instrMatch
    ? bodyContent.slice((instrMatch.index ?? 0) + instrMatch[0].length)
    : bodyContent;
  return {
    title: (fm.title as string) ?? "",
    status: (fm.status as string) ?? "inbox",
    created: (fm.created as string) ?? "",
    updated: (fm.updated as string) ?? "",
    workflow: (fm.workflow as string[]) ?? [],
    session_ids: (fm.session_ids as string[]) ?? [],
    instruction,
    filePath,
    body: bodyAfterInstruction.trim(),
  };
}

export async function createTaskFile(tasksDir: string, options: CreateTaskOptions): Promise<TaskRecord> {
  mkdirSync(tasksDir, { recursive: true });
  const now = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
  const datePrefix = dayjs().format("YYYY-MM-DD");
  const slug = slugify(options.title);
  const fileName = `${datePrefix}-${slug}.md`;
  const filePath = join(tasksDir, fileName);
  const frontmatter = {
    title: options.title,
    status: "inbox",
    created: now,
    updated: now,
    workflow: options.workflow,
    session_ids: [] as string[],
  };
  const content = buildTaskContent(frontmatter, options.instruction, "");
  await Bun.write(filePath, content);
  return { ...frontmatter, instruction: options.instruction, filePath, body: "" };
}

export async function readTaskFile(filePath: string): Promise<TaskRecord | null> {
  if (!existsSync(filePath)) return null;
  const content = await Bun.file(filePath).text();
  return parseTaskContent(content, filePath);
}

export async function updateTaskStatus(filePath: string, newStatus: string): Promise<void> {
  const content = await Bun.file(filePath).text();
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch?.[1]) return;
  const fm = parseYaml(fmMatch[1]) as Record<string, unknown>;
  fm.status = newStatus;
  fm.updated = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
  const rest = content.slice(fmMatch[0].length);
  const updated = `---\n${stringifyYaml(fm).trim()}\n---${rest}`;
  await Bun.write(filePath, updated);
}

export async function listTasks(tasksDir: string, options?: ListTasksOptions): Promise<TaskRecord[]> {
  if (!existsSync(tasksDir)) return [];
  const files = readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
  const tasks: TaskRecord[] = [];
  for (const file of files) {
    const filePath = join(tasksDir, file);
    const task = await readTaskFile(filePath);
    if (!task) continue;
    if (options?.status && task.status !== options.status) continue;
    tasks.push(task);
  }
  return tasks.sort((a, b) => b.created.localeCompare(a.created));
}
