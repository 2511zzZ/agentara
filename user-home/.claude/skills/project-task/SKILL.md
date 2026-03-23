---
name: project-task
description: >
  Create and manage project development tasks via Claude Code sub-sessions linked to Feishu group topics.
  Use whenever the user wants to start a coding task on any project (Birder, Chimera, etc.),
  resume an existing task, relay follow-up instructions, or check task status.
  Triggers on: "创建任务", "新任务", "new task", "开个任务", "在 X 项目做 Y",
  "帮我改一下 X", "继续上次的任务", "resume task", "任务状态", "task status",
  or any request that implies code changes in a specific project directory.
  Also trigger when the user references a Feishu topic and wants to relay instructions to the linked session.
---

# Project Task

Orchestrate development tasks by spawning Claude Code sub-sessions in project directories, with Feishu group topics as the communication channel. The user gives a brief requirement; this skill polishes it into a proper task description, executes it in isolation, and keeps the Feishu topic as the persistent record.

## Why This Skill Exists

The user (Jojo) works as an architect/AI director — he gives concise requirements and expects Claude to handle the full development workflow autonomously. A raw instruction like "移除设置按钮" implicitly means: make the change, verify it works, commit it, and potentially deploy. This skill bridges the gap between brief human intent and complete engineering execution.

## Flow Overview

```
1. Identify project → read project background
2. Polish task description → enrich with standard workflow steps
3. Create Feishu topic → visibility and async communication
4. Start claude sub-session → execute in project directory
5. Post result to topic → session_id + outcome
6. Resume on follow-up → claude --resume with same session
```

---

## Step 1: Identify Project

Determine which project the task targets. Read the matching background doc from `memory/projects/`:

```
memory/projects/birder.md
memory/projects/chimera.md
memory/projects/cli-game-dev-framework.md
memory/projects/knowledge-management.md
```

This gives you the project's stack, status, and development conventions — context that informs how you polish the task description in the next step.

### Project Directory Lookup

| Project | Directory |
|---------|-----------|
| birder / Birder | /Users/rainbowo/Projects/Birder |

For unlisted projects, search:
```bash
find /Users/rainbowo/Projects -maxdepth 2 -type d -name "<project>" 2>/dev/null
```

## Step 2: Polish Task Description

The user's raw requirement is usually terse — a feature request, bug fix, or UI change in a few words. Before passing it to the sub-session, enrich it with standard workflow expectations that the user would otherwise have to spell out every time.

### What to add

Based on the project background and the nature of the task, append relevant workflow instructions. Think about what a senior engineer would expect as part of "done":

- **Code changes**: implied by the task itself — no need to restate
- **Commit**: almost always expected after code changes. Use a clear, descriptive commit message.
- **Build/verify**: if the project has a build step (iOS → Xcode build, web → npm build), include verification
- **Deploy/run**: only if the user explicitly mentions it ("运行到手机", "部署")
- **Test**: if the project has tests, mention running them
- **Branch**: only if the task is large enough to warrant a feature branch

### What NOT to add

Don't over-prescribe. The sub-session's own CLAUDE.md and project skills will handle project-specific details (like which Xcode scheme to use, or how to run on a device). Your job is to add **workflow-level** completeness, not implementation details.

### Example

Raw requirement:
> "移除首页右上角的设置按钮"

Polished task description:
> "移除首页右上角的设置按钮。完成修改后，确保项目能正常构建，并提交代码（commit message 描述清楚改动内容）。"

Raw requirement:
> "移除首页右上角的设置按钮，完成后运行到我的手机上"

Polished task description:
> "移除首页右上角的设置按钮。完成修改后，确保项目能正常构建，提交代码（commit message 描述清楚改动内容），然后运行到我的手机上。"

Raw requirement:
> "加一个深色模式开关"

Polished task description:
> "在设置页面添加深色模式开关，实现深色/浅色主题切换。完成后确保构建通过，运行测试，提交代码。"

The polishing should feel natural — like a tech lead clarifying a ticket, not a bureaucrat adding boilerplate.

## Step 3: Create Feishu Topic

Send a message to the ClawBot group to create a topic thread. This becomes the persistent record for the task.

> **IMPORTANT**: All `feishu-cli` commands must be prefixed with:
> ```
> NO_PROXY="*" no_proxy="*" HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy=""
> ```
> This bypasses the local proxy which causes connection resets.

```bash
NO_PROXY="*" no_proxy="*" HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy="" \
  feishu-cli msg send \
  --receive-id oc_cecad8665fbcfffd9479802af585e40b \
  --receive-id-type chat_id \
  --msg-type post \
  --content '{"zh_cn":{"title":"🐙 <Project>: <Short Task Title>","content":[[{"tag":"text","text":"需求：<polished task description>"}]]}}'
```

Save the returned `message_id` — this is the **topic root** you'll reply to later.

## Step 4: Start Claude Sub-Session

Launch a Claude Code process in the project directory. Use `--output-format json` so you can parse the session_id from the result.

```bash
cd <project_dir> && claude -p "<polished task description>" \
  --output-format json \
  --dangerously-skip-permissions \
  2>&1
```

Run this via the Bash tool with `run_in_background: true` — tasks can take minutes for builds/deploys. Set timeout to 600000ms (10 min) for safety.

When the background task completes, parse the JSON output for:
- `session_id` — needed for `--resume` later
- `result` — the text summary of what happened
- `total_cost_usd` — optional, for cost awareness

## Step 5: Post Result to Topic

Reply to the topic root message with the session_id and outcome:

```bash
NO_PROXY="*" no_proxy="*" HTTP_PROXY="" HTTPS_PROXY="" http_proxy="" https_proxy="" \
  feishu-cli msg reply <root_message_id> \
  --msg-type post \
  --content '{"zh_cn":{"title":"","content":[[{"tag":"text","text":"Session ID: <session_id>\n状态：✅ 完成\n\n<result summary>\n\n如需追加指令，在本话题下回复。"}]]}}'
```

If the task failed, use `❌ 失败` and include the error details so the user can see what went wrong.

## Step 6: Resume (Follow-up Instructions)

When the user sends a follow-up instruction — either directly to you or via the Feishu topic:

1. **Find the session_id**: look for "Session ID: xxx" in the topic messages, or recall it from conversation context
2. **Resume the session**:

```bash
cd <project_dir> && claude --resume <session_id> -p "<follow-up instruction>" \
  --output-format json \
  --dangerously-skip-permissions \
  2>&1
```

3. **Post the new result** to the same topic thread as another reply

This preserves full conversation context — the sub-agent remembers all previous changes and can build on them.

---

## Design Principles

**Don't micromanage the sub-session.** Each project has its own CLAUDE.md and skills (e.g., Birder has `run-on-iphone`, `birder-uitest`). The sub-agent will discover and use these autonomously. Your job is to provide a clear, complete task description — not to prescribe implementation steps.

**Session ID lives in Feishu.** The topic messages are the source of truth for session-to-task mapping. No separate state files needed.

**Proxy matters.** Always use the `NO_PROXY` prefix for `feishu-cli`. Without it, requests hit a local proxy that resets connections.
