/**
 * GitLab 权限验证
 */

import type { GitLabApiClient } from "../api/client";
import type { GitLabPlatformContext } from "../../shared/types";

/**
 * 检查用户是否有项目写权限
 */
export async function checkWritePermissions(
  client: GitLabApiClient,
  _context: GitLabPlatformContext,
): Promise<boolean> {
  try {
    const permissions = await client.getUserPermissions();

    // GitLab 权限级别：
    // - 10 = Guest
    // - 20 = Reporter
    // - 30 = Developer (可以推送到非保护分支)
    // - 40 = Maintainer (可以推送到保护分支)
    // - 50 = Owner

    const accessLevel = permissions.project_access?.access_level || 0;

    // 至少需要 Developer 级别权限才能创建分支和提交
    return accessLevel >= 30;
  } catch (error) {
    console.error("Failed to check permissions:", error);
    return false;
  }
}

/**
 * 检查用户是否可以操作特定分支
 */
export async function checkBranchPermissions(
  client: GitLabApiClient,
  branchName: string,
): Promise<boolean> {
  try {
    // 检查分支是否受保护
    const branches = await client.getBranches();
    const branch = branches.find((b) => b.name === branchName);

    if (!branch) {
      // 分支不存在，检查是否能创建
      return true;
    }

    if (branch.protected) {
      // 保护分支需要 Maintainer 权限
      const permissions = await client.getUserPermissions();
      const accessLevel = permissions.project_access?.access_level || 0;
      return accessLevel >= 40;
    }

    return true;
  } catch (error) {
    console.error("Failed to check branch permissions:", error);
    return false;
  }
}

/**
 * 检查用户是否可以在合并请求中添加评论
 */
export async function checkCommentPermissions(
  client: GitLabApiClient,
  _context: GitLabPlatformContext,
): Promise<boolean> {
  try {
    // Reporter 级别以上就可以评论
    const permissions = await client.getUserPermissions();
    const accessLevel = permissions.project_access?.access_level || 0;
    return accessLevel >= 20;
  } catch (error) {
    console.error("Failed to check comment permissions:", error);
    return false;
  }
}
