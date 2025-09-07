/**
 * 平台检测器 - 自动检测当前运行环境的平台类型
 */

import type { PlatformType, PlatformAdapter } from "./types";
import { GitLabAdapter } from "../gitlab/adapter";

// 如果需要支持 GitHub，可以在这里导入
// import { GitHubAdapter } from '../github/adapter';

/**
 * 检测当前运行环境的平台类型
 */
export function detectPlatform(): PlatformType {
  // GitLab CI/CD 环境检测
  if (process.env.GITLAB_CI === "true" || process.env.CI_PROJECT_ID) {
    return "gitlab";
  }

  // GitHub Actions 环境检测
  if (process.env.GITHUB_ACTIONS === "true" || process.env.GITHUB_REPOSITORY) {
    return "github";
  }

  // 默认回退到 GitHub（向后兼容）
  return "github";
}

/**
 * 获取当前平台的适配器实例
 */
export function getPlatformAdapter(): PlatformAdapter {
  const platform = detectPlatform();

  switch (platform) {
    case "gitlab":
      return new GitLabAdapter();

    case "github":
      // 这里需要实现 GitHubAdapter 或导入现有的 GitHub 实现
      throw new Error("GitHub adapter not implemented in this context");

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * 检查是否在 CI/CD 环境中运行
 */
export function isInCIEnvironment(): boolean {
  return Boolean(
    process.env.CI || process.env.GITLAB_CI || process.env.GITHUB_ACTIONS,
  );
}

/**
 * 获取平台特定的环境信息
 */
export function getPlatformInfo() {
  const platform = detectPlatform();

  const info = {
    platform,
    isCI: isInCIEnvironment(),
    environmentVars: {} as Record<string, string>,
  };

  switch (platform) {
    case "gitlab":
      info.environmentVars = {
        projectId: process.env.CI_PROJECT_ID || "",
        projectName: process.env.CI_PROJECT_NAME || "",
        projectNamespace: process.env.CI_PROJECT_NAMESPACE || "",
        pipelineId: process.env.CI_PIPELINE_ID || "",
        jobId: process.env.CI_JOB_ID || "",
        mergeRequestIid: process.env.CI_MERGE_REQUEST_IID || "",
        commitSha: process.env.CI_COMMIT_SHA || "",
        ref: process.env.CI_COMMIT_REF_NAME || "",
      };
      break;

    case "github":
      info.environmentVars = {
        repository: process.env.GITHUB_REPOSITORY || "",
        runId: process.env.GITHUB_RUN_ID || "",
        runNumber: process.env.GITHUB_RUN_NUMBER || "",
        actor: process.env.GITHUB_ACTOR || "",
        eventName: process.env.GITHUB_EVENT_NAME || "",
        sha: process.env.GITHUB_SHA || "",
        ref: process.env.GITHUB_REF || "",
      };
      break;
  }

  return info;
}
