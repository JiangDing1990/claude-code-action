/**
 * GitLab 适配器测试
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { GitLabAdapter } from "../src/platforms/gitlab/adapter";
import { detectPlatform } from "../src/platforms/shared/platform-detector";

// Mock 环境变量
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

describe("GitLab Platform Detection", () => {
  it("should detect GitLab environment", () => {
    process.env.GITLAB_CI = "true";
    process.env.CI_PROJECT_ID = "123";

    expect(detectPlatform()).toBe("gitlab");
  });

  it("should detect GitHub environment", () => {
    delete process.env.GITLAB_CI;
    delete process.env.CI_PROJECT_ID;
    process.env.GITHUB_ACTIONS = "true";

    expect(detectPlatform()).toBe("github");
  });

  it("should default to GitHub when no CI environment detected", () => {
    delete process.env.GITLAB_CI;
    delete process.env.CI_PROJECT_ID;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REPOSITORY;

    expect(detectPlatform()).toBe("github");
  });
});

describe("GitLabAdapter", () => {
  let adapter: GitLabAdapter;

  beforeEach(() => {
    adapter = new GitLabAdapter();
  });

  it("should have correct platform type", () => {
    expect(adapter.platform).toBe("gitlab");
  });

  it("should detect GitLab environment correctly", () => {
    // 设置 GitLab CI 环境变量
    process.env.GITLAB_CI = "true";
    process.env.CI_PROJECT_ID = "123";

    expect(adapter.isCurrentPlatform()).toBe(true);

    // 清除 GitLab CI 环境变量
    delete process.env.GITLAB_CI;
    delete process.env.CI_PROJECT_ID;

    expect(adapter.isCurrentPlatform()).toBe(false);
  });

  it("should require necessary environment variables for context parsing", () => {
    delete process.env.CI_PROJECT_ID;

    expect(() => adapter.parseContext()).toThrow(
      "CI_PROJECT_ID environment variable is required for GitLab context",
    );
  });

  it("should parse GitLab context correctly", () => {
    // 设置测试环境变量
    process.env.CI_PROJECT_ID = "123";
    process.env.CI_PROJECT_NAME = "test-project";
    process.env.CI_PROJECT_NAMESPACE = "test-group";
    process.env.CI_PROJECT_PATH = "test-group/test-project";
    process.env.CI_JOB_ID = "456";
    process.env.CI_MERGE_REQUEST_IID = "789";
    process.env.GITLAB_USER_LOGIN = "testuser";

    const context = adapter.parseContext();

    expect(context.platform).toBe("gitlab");
    expect(context.projectId).toBe(123);
    expect(context.repository.owner).toBe("test-group");
    expect(context.repository.name).toBe("test-project");
    expect(context.mergeRequestIid).toBe(789);
    expect(context.eventType).toBe("merge_request");
    expect(context.actor).toBe("testuser");
  });
});

describe("GitLab Token Management", () => {
  it("should prioritize explicit tokens", async () => {
    process.env.GITLAB_TOKEN = "explicit-token";
    process.env.CI_JOB_TOKEN = "job-token";

    const { getGitLabToken } = await import("../src/platforms/gitlab/token");

    const token = await getGitLabToken();
    expect(token).toBe("explicit-token");
  });

  it("should fallback to CI job token", async () => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_ACCESS_TOKEN;
    delete process.env.PRIVATE_TOKEN;
    process.env.CI_JOB_TOKEN = "job-token";
    process.env.GITLAB_CI = "true";

    const { getGitLabToken } = await import("../src/platforms/gitlab/token");

    const token = await getGitLabToken();
    expect(token).toBe("job-token");
  });

  it("should throw error when no token available", async () => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_ACCESS_TOKEN;
    delete process.env.PRIVATE_TOKEN;
    delete process.env.CI_JOB_TOKEN;

    const { getGitLabToken } = await import("../src/platforms/gitlab/token");

    await expect(getGitLabToken()).rejects.toThrow("No GitLab token found");
  });
});
