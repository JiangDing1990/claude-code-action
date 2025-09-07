/**
 * 平台抽象层类型定义
 * 支持 GitHub 和 GitLab 平台的统一接口
 */

export type PlatformType = "github" | "gitlab";

/**
 * 平台上下文基础类型
 */
export interface BasePlatformContext {
  platform: PlatformType;
  runId: string;
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  actor: string;
  inputs: {
    prompt: string;
    triggerPhrase: string;
    assigneeTrigger: string;
    labelTrigger: string;
    baseBranch?: string;
    branchPrefix: string;
    useStickyComment: boolean;
    useCommitSigning: boolean;
    allowedBots: string;
  };
}

/**
 * GitHub 特定上下文
 */
export interface GitHubPlatformContext extends BasePlatformContext {
  platform: "github";
  eventName: string;
  eventAction?: string;
  entityNumber: number;
  isPR: boolean;
  payload: any;
}

/**
 * GitLab 特定上下文
 */
export interface GitLabPlatformContext extends BasePlatformContext {
  platform: "gitlab";
  projectId: number;
  eventType: "merge_request" | "issue" | "pipeline" | "push";
  mergeRequestIid?: number;
  issueIid?: number;
  pipelineId?: number;
  payload: any;
}

/**
 * 统一平台上下文类型
 */
export type PlatformContext = GitHubPlatformContext | GitLabPlatformContext;

/**
 * 平台 API 客户端接口
 */
export interface PlatformApiClient {
  platform: PlatformType;

  // 获取合并请求/PR 信息
  getMergeRequest(id: number): Promise<any>;

  // 获取议题信息
  getIssue(id: number): Promise<any>;

  // 创建评论
  createComment(
    entityId: number,
    body: string,
    entityType: "merge_request" | "issue",
  ): Promise<any>;

  // 更新评论
  updateComment(
    commentId: number,
    body: string,
    entityId?: number,
    entityType?: "merge_request" | "issue",
  ): Promise<any>;

  // 创建分支
  createBranch(branchName: string, ref: string): Promise<any>;

  // 提交文件
  commitFiles(
    branchName: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<any>;
}

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  readonly platform: PlatformType;

  /**
   * 检测当前运行环境是否为该平台
   */
  isCurrentPlatform(): boolean;

  /**
   * 解析平台上下文
   */
  parseContext(): PlatformContext;

  /**
   * 创建 API 客户端
   */
  createApiClient(token: string): PlatformApiClient;

  /**
   * 验证权限
   */
  validatePermissions(
    client: PlatformApiClient,
    context: PlatformContext,
  ): Promise<boolean>;

  /**
   * 获取认证 token
   */
  getAuthToken(): Promise<string>;
}
