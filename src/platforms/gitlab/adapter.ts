/**
 * GitLab 平台适配器实现
 */

import type {
  PlatformAdapter,
  PlatformApiClient,
  GitLabPlatformContext,
} from "../shared/types";
import { GitLabApiClient } from "./api/client";
import { parseGitLabContext, isGitLabEnvironment } from "./context";
import { checkWritePermissions } from "./validation/permissions";
import { getGitLabToken, validateGitLabToken } from "./token";
import { GITLAB_API_URL } from "./api/config";

export class GitLabAdapter implements PlatformAdapter {
  readonly platform = "gitlab" as const;

  /**
   * 检测是否在 GitLab 环境中运行
   */
  isCurrentPlatform(): boolean {
    return isGitLabEnvironment();
  }

  /**
   * 解析 GitLab 上下文
   */
  parseContext(): GitLabPlatformContext {
    return parseGitLabContext();
  }

  /**
   * 创建 GitLab API 客户端
   */
  createApiClient(token: string): GitLabApiClient {
    const context = this.parseContext();
    const baseUrl = process.env.GITLAB_API_URL || GITLAB_API_URL;

    return new GitLabApiClient(token, context.projectId, baseUrl);
  }

  /**
   * 验证权限
   */
  async validatePermissions(
    client: PlatformApiClient,
    context: GitLabPlatformContext,
  ): Promise<boolean> {
    if (!(client instanceof GitLabApiClient)) {
      throw new Error("Invalid client type for GitLab adapter");
    }

    return checkWritePermissions(client, context);
  }

  /**
   * 获取认证 token
   */
  async getAuthToken(): Promise<string> {
    const token = await getGitLabToken();

    // 验证 token 有效性
    const baseUrl = process.env.GITLAB_API_URL || GITLAB_API_URL;
    const isValid = await validateGitLabToken(token, baseUrl);

    if (!isValid) {
      throw new Error("Invalid GitLab token");
    }

    return token;
  }
}
