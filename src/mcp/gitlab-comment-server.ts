#!/usr/bin/env node
// GitLab Comment Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";
import { GITLAB_API_URL } from "../platforms/gitlab/api/config";

type GitLabNote = {
  id: number;
  body: string;
  author: {
    id: number;
    username: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  system: boolean;
  noteable_type: string;
  noteable_id: number;
};

// 从环境变量获取配置
const PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_BASE_URL = process.env.GITLAB_API_URL || GITLAB_API_URL;

if (!PROJECT_ID || !GITLAB_TOKEN) {
  console.error(
    "Error: GITLAB_PROJECT_ID and GITLAB_TOKEN environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitLab Comment Operations Server",
  version: "0.0.1",
});

// 辅助函数：发送请求到 GitLab API
async function makeGitLabRequest(
  endpoint: string,
  options: any = {},
): Promise<any> {
  const url = `${GITLAB_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "PRIVATE-TOKEN": GITLAB_TOKEN!,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return response;
}

// 创建合并请求评论
server.tool(
  "create_merge_request_comment",
  "Create a comment on a GitLab merge request",
  {
    merge_request_iid: z
      .number()
      .describe("The internal ID (IID) of the merge request"),
    body: z.string().describe("The comment body (supports Markdown)"),
  },
  async ({ merge_request_iid, body }) => {
    try {
      const response = await makeGitLabRequest(
        `/projects/${PROJECT_ID}/merge_requests/${merge_request_iid}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create merge request comment: ${response.status} - ${errorText}`,
        );
      }

      const noteData = (await response.json()) as GitLabNote;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: noteData.id,
                body: noteData.body,
                author: noteData.author.username,
                created_at: noteData.created_at,
                web_url: `${GITLAB_BASE_URL.replace("/api/v4", "")}/${process.env.CI_PROJECT_PATH}/-/merge_requests/${merge_request_iid}#note_${noteData.id}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// 更新合并请求评论
server.tool(
  "update_merge_request_comment",
  "Update an existing comment on a GitLab merge request",
  {
    merge_request_iid: z
      .number()
      .describe("The internal ID (IID) of the merge request"),
    note_id: z.number().describe("The ID of the note/comment to update"),
    body: z.string().describe("The updated comment body (supports Markdown)"),
  },
  async ({ merge_request_iid, note_id, body }) => {
    try {
      const response = await makeGitLabRequest(
        `/projects/${PROJECT_ID}/merge_requests/${merge_request_iid}/notes/${note_id}`,
        {
          method: "PUT",
          body: JSON.stringify({ body }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to update merge request comment: ${response.status} - ${errorText}`,
        );
      }

      const noteData = (await response.json()) as GitLabNote;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: noteData.id,
                body: noteData.body,
                author: noteData.author.username,
                updated_at: noteData.updated_at,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// 创建议题评论
server.tool(
  "create_issue_comment",
  "Create a comment on a GitLab issue",
  {
    issue_iid: z.number().describe("The internal ID (IID) of the issue"),
    body: z.string().describe("The comment body (supports Markdown)"),
  },
  async ({ issue_iid, body }) => {
    try {
      const response = await makeGitLabRequest(
        `/projects/${PROJECT_ID}/issues/${issue_iid}/notes`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to create issue comment: ${response.status} - ${errorText}`,
        );
      }

      const noteData = (await response.json()) as GitLabNote;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: noteData.id,
                body: noteData.body,
                author: noteData.author.username,
                created_at: noteData.created_at,
                web_url: `${GITLAB_BASE_URL.replace("/api/v4", "")}/${process.env.CI_PROJECT_PATH}/-/issues/${issue_iid}#note_${noteData.id}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// 更新议题评论
server.tool(
  "update_issue_comment",
  "Update an existing comment on a GitLab issue",
  {
    issue_iid: z.number().describe("The internal ID (IID) of the issue"),
    note_id: z.number().describe("The ID of the note/comment to update"),
    body: z.string().describe("The updated comment body (supports Markdown)"),
  },
  async ({ issue_iid, note_id, body }) => {
    try {
      const response = await makeGitLabRequest(
        `/projects/${PROJECT_ID}/issues/${issue_iid}/notes/${note_id}`,
        {
          method: "PUT",
          body: JSON.stringify({ body }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to update issue comment: ${response.status} - ${errorText}`,
        );
      }

      const noteData = (await response.json()) as GitLabNote;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: noteData.id,
                body: noteData.body,
                author: noteData.author.username,
                updated_at: noteData.updated_at,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// 获取合并请求评论列表
server.tool(
  "list_merge_request_comments",
  "List all comments on a GitLab merge request",
  {
    merge_request_iid: z
      .number()
      .describe("The internal ID (IID) of the merge request"),
    per_page: z
      .number()
      .optional()
      .describe("Number of comments per page (default: 20, max: 100)"),
    page: z.number().optional().describe("Page number (default: 1)"),
  },
  async ({ merge_request_iid, per_page = 20, page = 1 }) => {
    try {
      const response = await makeGitLabRequest(
        `/projects/${PROJECT_ID}/merge_requests/${merge_request_iid}/notes?per_page=${per_page}&page=${page}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to list merge request comments: ${response.status} - ${errorText}`,
        );
      }

      const notes = (await response.json()) as GitLabNote[];

      const simplifiedNotes = notes
        .filter((note) => !note.system) // 排除系统评论
        .map((note) => ({
          id: note.id,
          body: note.body,
          author: note.author.username,
          created_at: note.created_at,
          updated_at: note.updated_at,
        }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(simplifiedNotes, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
