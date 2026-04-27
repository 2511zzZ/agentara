import fs from "node:fs";
import nodePath from "node:path";

import {
  config,
  type AssistantMessage,
  type BashToolUseMessageContent,
  type EditToolUseMessageContent,
  type GlobToolUseMessageContent,
  type GrepToolUseMessageContent,
  type ReadToolUseMessageContent,
  type SkillToolUseMessageContent,
  type ToolUseMessageContent,
  type WebFetchToolUseMessageContent,
  type WebSearchToolUseMessageContent,
  type WriteToolUseMessageContent,
} from "@/shared";

import type {
  Card,
  CollapsiblePanel,
  DivElement,
  MarkdownElement,
} from "./types";

/**
 * Render assistant message content as a Feishu interactive card.
 * @param messageContent - Array of content blocks (thinking, tool_use, text).
 * @param options - Rendering options (streaming mode).
 * @returns Feishu Card object for API payload.
 */
export async function renderMessageCard(
  messageContent: AssistantMessage["content"],
  {
    streaming,
    uploadImage,
  }: {
    streaming: boolean;
    // eslint-disable-next-line no-unused-vars
    uploadImage: (path: string) => Promise<string>;
  },
): Promise<Card> {
  const stepPanel: CollapsiblePanel = {
    tag: "collapsible_panel",
    expanded: streaming,
    border: {
      color: "grey-300",
      corner_radius: "6px",
    },
    vertical_spacing: "2px",
    header: {
      title: {
        tag: "plain_text",
        text_color: "grey",
        text_size: "notation",
        content: "",
      },
      icon: {
        tag: "standard_icon",
        token: "right_outlined",
        color: "grey",
      },
      icon_position: "right",
      icon_expanded_angle: 90,
    },
    elements: [],
  };
  const card: Card = {
    schema: "2.0",
    config: {
      streaming_mode: true,
      enable_forward: true,
      enable_forward_interaction: true,
      update_multi: true,
      width_mode: "fill",
      summary: {
        content: "",
      },
    },
    body: {
      elements: [stepPanel],
    },
  };
  let pendingKey: string | null = null;
  let pendingItems: typeof messageContent = [];
  const flushPending = () => {
    if (pendingKey && pendingItems.length > 0) {
      _renderMergedSteps(pendingKey, pendingItems, stepPanel);
    }
    pendingKey = null;
    pendingItems = [];
  };
  for (const content of messageContent) {
    const key = _getStepGroupKey(content);
    if (key === null) {
      flushPending();
      continue;
    }
    if (key !== pendingKey) {
      flushPending();
      pendingKey = key;
    }
    pendingItems.push(content);
  }
  flushPending();
  if (!streaming) {
    // Find the last text block (final response), not all text blocks
    const lastTextContent = messageContent.findLast((c) => c.type === "text");
    if (lastTextContent) {
      const markdownContent = await _uploadMessageResource(
        lastTextContent.text,
        {
          uploadImage,
        },
      );
      const resultElement: MarkdownElement = {
        tag: "markdown",
        content: markdownContent,
      };
      card.config!.summary.content = markdownContent;
      card.body.elements.push(resultElement);
    }
  }

  const stepCount = stepPanel.elements.length;
  if (stepCount > 0) {
    const stepCountText =
      stepCount + " " + (stepCount === 1 ? "step" : "steps");
    if (streaming) {
      stepPanel.header.title.content = `Working on it (${stepCountText})`;
      card.config!.summary.content = `Working on it (${stepCountText})`;
    } else {
      stepPanel.header.title.content = `Show ${stepCountText}`;
    }
  } else {
    // No steps, remove the collapsible panel if it exists
    if (card.body.elements[0]?.tag === "collapsible_panel") {
      card.body.elements.splice(0, 1);
    }
    if (card.body.elements.length === 0) {
      card.body.elements.push({
        tag: "div",
        text: {
          tag: "plain_text",
          content: "",
        },
      });
    }
  }
  if (streaming) {
    card.body.elements.push({
      tag: "div",
      icon: {
        tag: "standard_icon",
        token: "more_outlined",
        color: "grey",
      },
    });
  }
  return card;
}

async function _uploadMessageResource(
  text: string,
  {
    uploadImage,
  }: {
    // eslint-disable-next-line no-unused-vars
    uploadImage: (path: string) => Promise<string>;
  },
): Promise<string> {
  const images = text.match(/!\[.*?\]\((.*?)\)/g);
  if (images) {
    for (const image of images) {
      let imagePath = image.match(/!\[.*?\]\((.*?)\)/)?.[1];
      if (imagePath) {
        if (imagePath.startsWith("http:") || imagePath.startsWith("https:")) {
          try {
            const response = await fetch(imagePath);
            const imageBuffer = await response.arrayBuffer();
            const imageName = imagePath.split("/").pop();
            const downloadPath = nodePath.join(
              config.paths.workspace,
              "downloads",
            );
            if (!fs.existsSync(downloadPath)) {
              fs.mkdirSync(downloadPath, { recursive: true });
            }
            if (imageName) {
              fs.writeFileSync(
                nodePath.join(downloadPath, imageName),
                Buffer.from(imageBuffer),
              );
              imagePath = nodePath.join("workspace", "downloads", imageName);
            }
          } catch {
            text = text.replaceAll(image, `[${imagePath}](${imagePath})`);
          }
        }
        if (fs.existsSync(nodePath.join(config.paths.home, imagePath))) {
          const imageKey = await uploadImage(imagePath);
          text = text.replaceAll(image, `![image](${imageKey})`);
        } else {
          text = text.replaceAll(image, "");
        }
      }
    }
  }
  return text;
}

/** Render a single tool use step into the collapsible panel. */
function _renderTool(
  content: ToolUseMessageContent,
  stepPanel: CollapsiblePanel,
) {
  switch (content.name) {
    case "Agent":
    case "Task":
      stepPanel.elements.push(_renderStep("Run sub-agent", "robot_outlined"));
      break;
    case "Bash":
      const bashContent = content as BashToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          bashContent.input.description ?? bashContent.input.command,
          "computer_outlined",
        ),
      );
      break;
    case "Edit":
      const editContent = content as EditToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(`Edit "${editContent.input.file_path}"`, "edit_outlined"),
      );
      break;
    case "Glob":
      const globContent = content as GlobToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Search files by pattern "${globContent.input.pattern}"`,
          "card-search_outlined",
        ),
      );
      break;
    case "Grep":
      const grepContent = content as GrepToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Search text by pattern "${grepContent.input.pattern}" in "${grepContent.input.glob}"`,
          "doc-search_outlined",
        ),
      );
      break;
    case "WebFetch":
      const webFetchContent = content as WebFetchToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Fetch web page from "${webFetchContent.input.url}"`,
          "language_outlined",
        ),
      );
      break;
    case "WebSearch":
      const webSearchContent = content as WebSearchToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Search web for "${webSearchContent.input.query}"`,
          "search_outlined",
        ),
      );
      break;
    case "Read":
      const readContent = content as ReadToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Read file "${readContent.input.file_path}"`,
          "file-link-bitable_outlined",
        ),
      );
      break;
    case "Write":
      const writeContent = content as WriteToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Write file "${writeContent.input.file_path}"`,
          "edit_outlined",
        ),
      );
      break;
    case "Skill":
      const skillContent = content as SkillToolUseMessageContent;
      stepPanel.elements.push(
        _renderStep(
          `Load skill "${skillContent.input.skill}"`,
          "file-link-mindnote_outlined",
        ),
      );
      break;
    case "ToolSearch":
      // Ignore ToolSearch for now
      //
      // const toolSearchContent = content as ToolSearchToolUseMessageContent;
      // stepPanel.elements.push(
      //   renderStep(
      //     `Search tools for "${toolSearchContent.input.query}"`,
      //     "search_outlined",
      //   ),
      // );
      break;
    default:
      stepPanel.elements.push(
        _renderStep(content.name, "setting-inter_outlined"),
      );
  }
}

/** Create a step element (icon + text) for the collapsible panel. */
function _renderStep(text: string, iconToken: string): DivElement {
  return {
    tag: "div",
    icon: {
      tag: "standard_icon",
      token: iconToken,
      color: "grey",
    },
    text: {
      tag: "plain_text",
      text_color: "grey",
      text_size: "notation",
      content: text,
    },
  };
}

/** Get grouping key for consecutive step merging. */
function _getStepGroupKey(
  content: AssistantMessage["content"][number],
): string | null {
  if (content.type === "thinking") return "thinking";
  if (content.type === "tool_use") {
    if (content.name === "ToolSearch") return null;
    return content.name;
  }
  return null;
}

/** Render a group of consecutive same-type steps, merging if count > 1. */
function _renderMergedSteps(
  key: string,
  items: AssistantMessage["content"],
  stepPanel: CollapsiblePanel,
) {
  if (items.length === 1) {
    const content = items[0]!;
    if (content.type === "thinking") {
      stepPanel.elements.push(_renderStep(content.thinking, "robot_outlined"));
    } else if (content.type === "tool_use") {
      _renderTool(content, stepPanel);
    }
    return;
  }

  if (key === "thinking") {
    stepPanel.elements.push(
      _renderStep(`Thinking (${items.length} rounds)`, "robot_outlined"),
    );
    return;
  }

  const toolItems = items.filter(
    (i): i is ToolUseMessageContent => i.type === "tool_use",
  );
  const { icon, label, details } = _getMergedToolInfo(key, toolItems);

  const maxShow = 3;
  let text: string;
  if (details.length === 0) {
    text = label;
  } else {
    const shown = details.slice(0, maxShow).join(", ");
    text =
      details.length > maxShow
        ? `${label}: ${shown} ... +${details.length - maxShow} more`
        : `${label}: ${shown}`;
  }
  stepPanel.elements.push(_renderStep(text, icon));
}

function _getMergedToolInfo(
  toolName: string,
  items: ToolUseMessageContent[],
): { icon: string; label: string; details: string[] } {
  const n = items.length;
  switch (toolName) {
    case "Agent":
    case "Task":
      return { icon: "robot_outlined", label: `Run ${n} sub-agents`, details: [] };
    case "Bash":
      return {
        icon: "computer_outlined",
        label: `Run ${n} commands`,
        details: items.map((i) => {
          const b = i as BashToolUseMessageContent;
          const s = b.input.description ?? b.input.command;
          return s.length > 40 ? s.slice(0, 40) + "…" : s;
        }),
      };
    case "Edit":
      return {
        icon: "edit_outlined",
        label: `Edit ${n} files`,
        details: items.map((i) =>
          nodePath.basename((i as EditToolUseMessageContent).input.file_path),
        ),
      };
    case "Glob":
      return {
        icon: "card-search_outlined",
        label: `Search ${n} file patterns`,
        details: items.map(
          (i) => `"${(i as GlobToolUseMessageContent).input.pattern}"`,
        ),
      };
    case "Grep":
      return {
        icon: "doc-search_outlined",
        label: `Search ${n} text patterns`,
        details: items.map(
          (i) => `"${(i as GrepToolUseMessageContent).input.pattern}"`,
        ),
      };
    case "Read":
      return {
        icon: "file-link-bitable_outlined",
        label: `Read ${n} files`,
        details: items.map((i) =>
          nodePath.basename((i as ReadToolUseMessageContent).input.file_path),
        ),
      };
    case "Write":
      return {
        icon: "edit_outlined",
        label: `Write ${n} files`,
        details: items.map((i) =>
          nodePath.basename((i as WriteToolUseMessageContent).input.file_path),
        ),
      };
    case "WebFetch":
      return {
        icon: "language_outlined",
        label: `Fetch ${n} web pages`,
        details: items.map((i) => {
          const url = (i as WebFetchToolUseMessageContent).input.url;
          return url.length > 50 ? url.slice(0, 50) + "…" : url;
        }),
      };
    case "WebSearch":
      return {
        icon: "search_outlined",
        label: `Search web ${n} times`,
        details: items.map(
          (i) => `"${(i as WebSearchToolUseMessageContent).input.query}"`,
        ),
      };
    case "Skill":
      return {
        icon: "file-link-mindnote_outlined",
        label: `Load ${n} skills`,
        details: items.map(
          (i) => `"${(i as SkillToolUseMessageContent).input.skill}"`,
        ),
      };
    default:
      return {
        icon: "setting-inter_outlined",
        label: `${toolName} (${n} calls)`,
        details: [],
      };
  }
}

/**
 * Regex pattern for matching markdown tables.
 * Matches: header row, separator row, and one or more data rows.
 */
const MARKDOWN_TABLE_REGEX =
  /^\|.+\|[ \t]*\n\|[\s:|-]+\|[ \t]*\n(?:\|.+\|[ \t]*\n?)+/gm;

/**
 * Split markdown content into multiple chunks, each containing at most a specified
 * number of tables. Used to work around Feishu's limit of 5 table components per card.
 *
 * @param markdown - The markdown content to split.
 * @param maxTables - Maximum number of tables per chunk (default: 5).
 * @returns Array of markdown strings, each with at most maxTables tables.
 */
export function splitMarkdownByTables(
  markdown: string,
  maxTables: number = 5,
): string[] {
  const tables = markdown.match(MARKDOWN_TABLE_REGEX);
  if (!tables || tables.length <= maxTables) {
    return [markdown];
  }

  // Find all table positions in the markdown
  const tablePositions: Array<{ start: number; end: number; match: string }> =
    [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MARKDOWN_TABLE_REGEX.source, "gm");
  while ((match = regex.exec(markdown)) !== null) {
    tablePositions.push({
      start: match.index,
      end: match.index + match[0].length,
      match: match[0],
    });
  }

  const chunks: string[] = [];
  let currentChunkStart = 0;
  let tablesInCurrentChunk = 0;

  for (let i = 0; i < tablePositions.length; i++) {
    const tablePos = tablePositions[i]!;
    tablesInCurrentChunk++;

    // If we've reached the max tables for this chunk, split here
    if (tablesInCurrentChunk >= maxTables && i < tablePositions.length - 1) {
      // End current chunk after this table
      const chunkEnd = tablePos.end;
      chunks.push(markdown.slice(currentChunkStart, chunkEnd).trim());

      // Start new chunk from the content after the current table
      currentChunkStart = chunkEnd;
      tablesInCurrentChunk = 0;
    }
  }

  // Add the remaining content as the last chunk
  const remainingContent = markdown.slice(currentChunkStart).trim();
  if (remainingContent) {
    chunks.push(remainingContent);
  }

  return chunks;
}
