import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTaskFile, readTaskFile, updateTaskStatus, listTasks } from "../task-file";

describe("task-file", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `task-file-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates a task file with frontmatter and instruction", async () => {
    const task = await createTaskFile(testDir, {
      title: "Build scanner",
      instruction: "Implement project scanning logic",
      workflow: ["plan", "implement", "test"],
    });

    expect(task.title).toBe("Build scanner");
    expect(task.status).toBe("inbox");
    expect(task.instruction).toBe("Implement project scanning logic");
    expect(task.workflow).toEqual(["plan", "implement", "test"]);
    expect(task.session_ids).toEqual([]);
    expect(task.filePath).toContain("build-scanner.md");
  });

  it("reads a task file back", async () => {
    const created = await createTaskFile(testDir, {
      title: "Read test",
      instruction: "Verify reading works",
      workflow: ["test"],
    });

    const read = await readTaskFile(created.filePath);
    expect(read).not.toBeNull();
    expect(read!.title).toBe("Read test");
    expect(read!.instruction).toBe("Verify reading works");
    expect(read!.status).toBe("inbox");
    expect(read!.workflow).toEqual(["test"]);
  });

  it("updates task status", async () => {
    const task = await createTaskFile(testDir, {
      title: "Status update",
      instruction: "Test status update",
      workflow: [],
    });

    expect(task.status).toBe("inbox");
    await updateTaskStatus(task.filePath, "in-progress");
    const updated = await readTaskFile(task.filePath);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in-progress");
    // updated timestamp should be set (may or may not differ within same second)
    expect(updated!.updated).toBeTruthy();
  });

  it("lists all tasks in a directory", async () => {
    await createTaskFile(testDir, {
      title: "Task A",
      instruction: "First task",
      workflow: [],
    });
    await createTaskFile(testDir, {
      title: "Task B",
      instruction: "Second task",
      workflow: [],
    });

    const tasks = await listTasks(testDir);
    expect(tasks).toHaveLength(2);
  });

  it("filters tasks by status", async () => {
    const taskA = await createTaskFile(testDir, {
      title: "Task Alpha",
      instruction: "Alpha instruction",
      workflow: [],
    });
    await createTaskFile(testDir, {
      title: "Task Beta",
      instruction: "Beta instruction",
      workflow: [],
    });

    await updateTaskStatus(taskA.filePath, "done");

    const inbox = await listTasks(testDir, { status: "inbox" });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.title).toBe("Task Beta");

    const done = await listTasks(testDir, { status: "done" });
    expect(done).toHaveLength(1);
    expect(done[0]!.title).toBe("Task Alpha");
  });

  it("returns null for nonexistent task file", async () => {
    const result = await readTaskFile(join(testDir, "nonexistent.md"));
    expect(result).toBeNull();
  });

  it("returns empty array for nonexistent tasks directory", async () => {
    const result = await listTasks(join(testDir, "nonexistent"));
    expect(result).toEqual([]);
  });
});
