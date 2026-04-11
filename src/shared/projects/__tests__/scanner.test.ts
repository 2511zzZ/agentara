import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanProjects, readProjectMeta } from "../scanner";

describe("scanner", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `scanner-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("returns empty array for empty directory", async () => {
    const result = await scanProjects(testDir);
    expect(result).toEqual([]);
  });

  it("discovers projects with meta.yaml", async () => {
    const projectDir = join(testDir, "my-project");
    mkdirSync(projectDir);
    writeFileSync(
      join(projectDir, "meta.yaml"),
      "name: My Project\ndescription: A test project\nstatus: active\ntags:\n  - test\n",
    );

    const result = await scanProjects(testDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("My Project");
    expect(result[0]!.description).toBe("A test project");
    expect(result[0]!.status).toBe("active");
    expect(result[0]!.tags).toEqual(["test"]);
  });

  it("skips directories without meta.yaml", async () => {
    mkdirSync(join(testDir, "no-meta"));
    const projectDir = join(testDir, "has-meta");
    mkdirSync(projectDir);
    writeFileSync(join(projectDir, "meta.yaml"), "name: HasMeta\nstatus: active\n");

    const result = await scanProjects(testDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("HasMeta");
  });

  it("filters by status", async () => {
    const activeDir = join(testDir, "active-proj");
    mkdirSync(activeDir);
    writeFileSync(join(activeDir, "meta.yaml"), "name: Active\nstatus: active\n");

    const archivedDir = join(testDir, "archived-proj");
    mkdirSync(archivedDir);
    writeFileSync(join(archivedDir, "meta.yaml"), "name: Archived\nstatus: archived\n");

    const all = await scanProjects(testDir);
    expect(all).toHaveLength(2);

    const activeOnly = await scanProjects(testDir, { status: "active" });
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0]!.name).toBe("Active");
  });

  it("returns null for readProjectMeta on missing directory", async () => {
    const result = await readProjectMeta(join(testDir, "nonexistent"));
    expect(result).toBeNull();
  });

  it("returns empty array for nonexistent registry directory", async () => {
    const result = await scanProjects(join(testDir, "nonexistent"));
    expect(result).toEqual([]);
  });
});
