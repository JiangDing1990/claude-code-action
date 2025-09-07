/**
 * GitLab API 配置
 */

export const GITLAB_API_URL =
  process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";

export const GITLAB_API_VERSION = "v4";

export const DEFAULT_PER_PAGE = 20;

export const MAX_PER_PAGE = 100;
