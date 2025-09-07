#!/usr/bin/env node
// GitLab File Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { join } from "path";
import fetch from "node-fetch";
import { GITLAB_API_URL } from "../platforms/gitlab/api/config";
import { retryWithBackoff } from "../utils/retry";

type GitLabCommit = {
  id: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
};

type GitLabBranch = {
  name: string;
  commit: GitLabCommit;
  protected: boolean;
};

// 从环境变量获取仓库信息
const PROJECT_ID = process.env.GITLAB_PROJECT_ID;
const BRANCH_NAME = process.env.BRANCH_NAME;
const REPO_DIR = process.env.REPO_DIR || process.cwd();
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const GITLAB_BASE_URL = process.env.GITLAB_API_URL || GITLAB_API_URL;

if (!PROJECT_ID || !BRANCH_NAME || !GITLAB_TOKEN) {
  console.error(
    "Error: GITLAB_PROJECT_ID, BRANCH_NAME, and GITLAB_TOKEN environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "GitLab File Operations Server",
  version: "0.0.1",
});

// 辅助函数：获取或创建分支引用
async function getOrCreateBranchRef(
  projectId: string,
  branchName: string,
  gitlabToken: string,
): Promise<string> {
  // 尝试获取分支
  const branchUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`;
  const branchResponse = await fetch(branchUrl, {
    headers: {
      "PRIVATE-TOKEN": gitlabToken,
    },
  });

  if (branchResponse.ok) {
    const branchData = (await branchResponse.json()) as GitLabBranch;
    return branchData.commit.id;
  }

  if (branchResponse.status !== 404) {
    throw new Error(`Failed to get branch: ${branchResponse.status}`);
  }

  // 分支不存在，需要创建
  const baseBranch = process.env.BASE_BRANCH || "main";

  // 获取基础分支的 commit ID
  const baseBranchUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/branches/${encodeURIComponent(baseBranch)}`;
  const baseBranchResponse = await fetch(baseBranchUrl, {
    headers: {
      "PRIVATE-TOKEN": gitlabToken,
    },
  });

  let baseCommitId: string;

  if (!baseBranchResponse.ok) {
    // 如果基础分支不存在，尝试获取默认分支
    const projectUrl = `${GITLAB_BASE_URL}/projects/${projectId}`;
    const projectResponse = await fetch(projectUrl, {
      headers: {
        "PRIVATE-TOKEN": gitlabToken,
      },
    });

    if (!projectResponse.ok) {
      throw new Error(`Failed to get project info: ${projectResponse.status}`);
    }

    const projectData = (await projectResponse.json()) as {
      default_branch: string;
    };
    const defaultBranch = projectData.default_branch;

    // 获取默认分支
    const defaultBranchUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/branches/${encodeURIComponent(defaultBranch)}`;
    const defaultBranchResponse = await fetch(defaultBranchUrl, {
      headers: {
        "PRIVATE-TOKEN": gitlabToken,
      },
    });

    if (!defaultBranchResponse.ok) {
      throw new Error(
        `Failed to get default branch: ${defaultBranchResponse.status}`,
      );
    }

    const defaultBranchData =
      (await defaultBranchResponse.json()) as GitLabBranch;
    baseCommitId = defaultBranchData.commit.id;
  } else {
    const baseBranchData = (await baseBranchResponse.json()) as GitLabBranch;
    baseCommitId = baseBranchData.commit.id;
  }

  // 创建新分支
  const createBranchUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/branches`;
  const createBranchResponse = await fetch(createBranchUrl, {
    method: "POST",
    headers: {
      "PRIVATE-TOKEN": gitlabToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      branch: branchName,
      ref: baseCommitId,
    }),
  });

  if (!createBranchResponse.ok) {
    const errorText = await createBranchResponse.text();
    throw new Error(
      `Failed to create branch: ${createBranchResponse.status} - ${errorText}`,
    );
  }

  console.log(`Successfully created branch ${branchName}`);
  return baseCommitId;
}

// 获取适当的文件模式 - 注释掉，当前版本不需要
// async function getFileMode(filePath: string): Promise<string> {
//   try {
//     const fileStat = await stat(filePath);
//     if (fileStat.isFile()) {
//       // 检查用户执行位是否设置
//       if (fileStat.mode & constants.S_IXUSR) {
//         return "100755"; // 可执行文件
//       } else {
//         return "100644"; // 普通文件
//       }
//     } else if (fileStat.isDirectory()) {
//       return "040000"; // 目录
//     } else if (fileStat.isSymbolicLink()) {
//       return "120000"; // 符号链接
//     } else {
//       return "100644"; // 默认
//     }
//   } catch (error) {
//     console.warn(`Could not determine file mode for ${filePath}, using default: ${error}`);
//     return "100644";
//   }
// }

// 提交文件工具
server.tool(
  "commit_files",
  "Commit one or more files to a GitLab repository in a single commit",
  {
    files: z
      .array(z.string())
      .describe(
        'Array of file paths relative to repository root (e.g. ["src/main.js", "README.md"]). All files must exist locally.',
      ),
    message: z.string().describe("Commit message"),
  },
  async ({ files, message }) => {
    const projectId = PROJECT_ID;
    const branch = BRANCH_NAME;
    try {
      const gitlabToken = GITLAB_TOKEN!;

      const processedFiles = files.map((filePath) => {
        if (filePath.startsWith("/")) {
          return filePath.slice(1);
        }
        return filePath;
      });

      // 1. 获取分支引用（如果不存在则创建）
      await getOrCreateBranchRef(projectId!, branch!, gitlabToken);

      // 2. 准备提交操作
      const actions = await Promise.all(
        processedFiles.map(async (filePath) => {
          const fullPath = filePath.startsWith("/")
            ? filePath
            : join(REPO_DIR, filePath);

          // 检查文件是否为二进制
          const isBinaryFile =
            /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|tar|gz|exe|bin|woff|woff2|ttf|eot)$/i.test(
              filePath,
            );

          if (isBinaryFile) {
            // 二进制文件使用 base64 编码
            const binaryContent = await readFile(fullPath);
            return {
              action: "create",
              file_path: filePath,
              content: binaryContent.toString("base64"),
              encoding: "base64",
            };
          } else {
            // 文本文件
            const content = await readFile(fullPath, "utf-8");
            return {
              action: "create",
              file_path: filePath,
              content: content,
            };
          }
        }),
      );

      // 3. 创建提交
      const commitUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/commits`;

      await retryWithBackoff(
        async () => {
          const commitResponse = await fetch(commitUrl, {
            method: "POST",
            headers: {
              "PRIVATE-TOKEN": gitlabToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              branch: branch,
              commit_message: message,
              actions: actions,
            }),
          });

          if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            throw new Error(
              `Failed to create commit: ${commitResponse.status} - ${errorText}`,
            );
          }

          const commitData = (await commitResponse.json()) as GitLabCommit;

          return {
            commit: {
              id: commitData.id,
              message: commitData.message,
              author: commitData.author_name,
              date: commitData.authored_date,
            },
            files: processedFiles.map((path) => ({ path })),
          };
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffFactor: 2,
        },
      );

      const result = {
        commit: {
          id: "success", // 将在重试成功后设置实际值
          message: message,
        },
        files: processedFiles.map((path) => ({ path })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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

// 删除文件工具
server.tool(
  "delete_files",
  "Delete one or more files from a GitLab repository in a single commit",
  {
    paths: z
      .array(z.string())
      .describe(
        'Array of file paths to delete relative to repository root (e.g. ["src/old-file.js", "docs/deprecated.md"])',
      ),
    message: z.string().describe("Commit message"),
  },
  async ({ paths, message }) => {
    const projectId = PROJECT_ID;
    const branch = BRANCH_NAME;
    try {
      const gitlabToken = GITLAB_TOKEN!;

      // 转换绝对路径为相对路径
      const cwd = process.cwd();
      const processedPaths = paths.map((filePath) => {
        if (filePath.startsWith("/")) {
          if (filePath.startsWith(cwd)) {
            return filePath.slice(cwd.length + 1);
          } else {
            throw new Error(
              `Path '${filePath}' must be relative to repository root or within current working directory`,
            );
          }
        }
        return filePath;
      });

      // 1. 获取分支引用（如果不存在则创建）
      await getOrCreateBranchRef(projectId!, branch!, gitlabToken);

      // 2. 准备删除操作
      const actions = processedPaths.map((path) => ({
        action: "delete",
        file_path: path,
      }));

      // 3. 创建提交
      const commitUrl = `${GITLAB_BASE_URL}/projects/${projectId}/repository/commits`;

      const result = await retryWithBackoff(
        async () => {
          const commitResponse = await fetch(commitUrl, {
            method: "POST",
            headers: {
              "PRIVATE-TOKEN": gitlabToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              branch: branch,
              commit_message: message,
              actions: actions,
            }),
          });

          if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            throw new Error(
              `Failed to create commit: ${commitResponse.status} - ${errorText}`,
            );
          }

          const commitData = (await commitResponse.json()) as GitLabCommit;

          return {
            commit: {
              id: commitData.id,
              message: commitData.message,
              author: commitData.author_name,
              date: commitData.authored_date,
            },
            deletedFiles: processedPaths.map((path) => ({ path })),
          };
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 5000,
          backoffFactor: 2,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
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
