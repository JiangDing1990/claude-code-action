/**
 * GitLab 上下文解析器
 */

import type { GitLabPlatformContext } from "../shared/types";

/**
 * GitLab CI/CD 环境变量
 * https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
 */
interface GitLabEnvironment {
  CI_PIPELINE_ID?: string;
  CI_JOB_ID?: string;
  CI_PROJECT_ID?: string;
  CI_PROJECT_NAME?: string;
  CI_PROJECT_NAMESPACE?: string;
  CI_PROJECT_PATH?: string;
  CI_MERGE_REQUEST_IID?: string;
  CI_MERGE_REQUEST_TARGET_BRANCH_NAME?: string;
  CI_MERGE_REQUEST_SOURCE_BRANCH_NAME?: string;
  CI_MERGE_REQUEST_EVENT_TYPE?: string;
  CI_COMMIT_REF_NAME?: string;
  CI_COMMIT_SHA?: string;
  GITLAB_USER_LOGIN?: string;
  GITLAB_USER_NAME?: string;

  // 自定义输入变量
  PROMPT?: string;
  TRIGGER_PHRASE?: string;
  ASSIGNEE_TRIGGER?: string;
  LABEL_TRIGGER?: string;
  BASE_BRANCH?: string;
  BRANCH_PREFIX?: string;
  USE_STICKY_COMMENT?: string;
  USE_COMMIT_SIGNING?: string;
  ALLOWED_BOTS?: string;
}

/**
 * 解析 GitLab CI/CD 上下文
 */
export function parseGitLabContext(): GitLabPlatformContext {
  const env = process.env as GitLabEnvironment;

  // 验证必需的环境变量
  if (!env.CI_PROJECT_ID) {
    throw new Error(
      "CI_PROJECT_ID environment variable is required for GitLab context",
    );
  }

  if (!env.CI_PROJECT_NAME || !env.CI_PROJECT_NAMESPACE) {
    throw new Error("CI_PROJECT_NAME and CI_PROJECT_NAMESPACE are required");
  }

  // 确定事件类型
  let eventType: "merge_request" | "issue" | "pipeline" | "push" = "pipeline";
  if (env.CI_MERGE_REQUEST_IID) {
    eventType = "merge_request";
  } else if (
    env.CI_COMMIT_REF_NAME &&
    env.CI_COMMIT_REF_NAME !== env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME
  ) {
    eventType = "push";
  }

  return {
    platform: "gitlab",
    runId: env.CI_JOB_ID || env.CI_PIPELINE_ID || "unknown",
    repository: {
      owner: env.CI_PROJECT_NAMESPACE!,
      name: env.CI_PROJECT_NAME!,
      fullName: env.CI_PROJECT_PATH!,
    },
    actor: env.GITLAB_USER_LOGIN || env.GITLAB_USER_NAME || "unknown",
    projectId: parseInt(env.CI_PROJECT_ID!),
    eventType,
    mergeRequestIid: env.CI_MERGE_REQUEST_IID
      ? parseInt(env.CI_MERGE_REQUEST_IID)
      : undefined,
    issueIid: undefined, // GitLab CI 不直接暴露 issue IID
    pipelineId: env.CI_PIPELINE_ID ? parseInt(env.CI_PIPELINE_ID) : undefined,
    payload: {
      // 构建原始 payload 对象
      pipeline: {
        id: env.CI_PIPELINE_ID,
      },
      project: {
        id: env.CI_PROJECT_ID,
        name: env.CI_PROJECT_NAME,
        namespace: env.CI_PROJECT_NAMESPACE,
        path: env.CI_PROJECT_PATH,
      },
      merge_request: env.CI_MERGE_REQUEST_IID
        ? {
            iid: env.CI_MERGE_REQUEST_IID,
            target_branch: env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME,
            source_branch: env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME,
            event_type: env.CI_MERGE_REQUEST_EVENT_TYPE,
          }
        : undefined,
      commit: {
        sha: env.CI_COMMIT_SHA,
        ref: env.CI_COMMIT_REF_NAME,
      },
      user: {
        login: env.GITLAB_USER_LOGIN,
        name: env.GITLAB_USER_NAME,
      },
    },
    inputs: {
      prompt: env.PROMPT || "",
      triggerPhrase: env.TRIGGER_PHRASE || "@claude",
      assigneeTrigger: env.ASSIGNEE_TRIGGER || "",
      labelTrigger: env.LABEL_TRIGGER || "",
      baseBranch: env.BASE_BRANCH || env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME,
      branchPrefix: env.BRANCH_PREFIX || "claude/",
      useStickyComment: env.USE_STICKY_COMMENT === "true",
      useCommitSigning: env.USE_COMMIT_SIGNING === "true",
      allowedBots: env.ALLOWED_BOTS || "",
    },
  };
}

/**
 * 检测是否在 GitLab CI/CD 环境中运行
 */
export function isGitLabEnvironment(): boolean {
  return process.env.GITLAB_CI === "true" || !!process.env.CI_PROJECT_ID;
}

/**
 * 类型守卫：检查是否为 GitLab 上下文
 */
export function isGitLabContext(
  context: any,
): context is GitLabPlatformContext {
  return context.platform === "gitlab";
}

/**
 * 检查是否为合并请求事件
 */
export function isMergeRequestEvent(context: GitLabPlatformContext): boolean {
  return context.eventType === "merge_request" && !!context.mergeRequestIid;
}

/**
 * 检查是否为议题事件
 */
export function isIssueEvent(context: GitLabPlatformContext): boolean {
  return context.eventType === "issue" && !!context.issueIid;
}
