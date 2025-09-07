/**
 * GitLab Token 管理
 */

/**
 * 获取 GitLab 访问令牌
 * 支持多种令牌类型：
 * 1. Personal Access Token (PAT)
 * 2. Project Access Token
 * 3. Group Access Token
 * 4. CI/CD Job Token (限制功能)
 */
export async function getGitLabToken(): Promise<string> {
  // 优先级：显式设置的 TOKEN > CI Job Token
  const explicitToken =
    process.env.GITLAB_TOKEN ||
    process.env.GITLAB_ACCESS_TOKEN ||
    process.env.PRIVATE_TOKEN;

  if (explicitToken) {
    console.log("Using explicit GitLab token");
    return explicitToken;
  }

  // 在 CI/CD 环境中，尝试使用 Job Token
  const ciJobToken = process.env.CI_JOB_TOKEN;
  if (ciJobToken && process.env.GITLAB_CI === "true") {
    console.log("Using GitLab CI Job Token (limited permissions)");
    return ciJobToken;
  }

  throw new Error(
    "No GitLab token found. Please provide one of:\n" +
      "- GITLAB_TOKEN environment variable\n" +
      "- GITLAB_ACCESS_TOKEN environment variable\n" +
      "- PRIVATE_TOKEN environment variable\n" +
      "Or ensure CI_JOB_TOKEN is available in GitLab CI/CD environment",
  );
}

/**
 * 验证 token 是否有效
 */
export async function validateGitLabToken(
  token: string,
  baseUrl: string = "https://gitlab.com/api/v4",
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/user`, {
      headers: {
        "PRIVATE-TOKEN": token,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token validation failed:", error);
    return false;
  }
}

/**
 * 获取 token 信息
 */
export async function getTokenInfo(
  token: string,
  baseUrl: string = "https://gitlab.com/api/v4",
): Promise<any> {
  const response = await fetch(`${baseUrl}/user`, {
    headers: {
      "PRIVATE-TOKEN": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get token info: ${response.status}`);
  }

  return response.json();
}
