#!/usr/bin/env bun

/**
 * GitLab 平台的准备脚本
 * 适配自原始的 prepare.ts，专门处理 GitLab CI/CD 环境
 */

import { GitLabAdapter } from "../platforms/gitlab/adapter";
import { writeFile } from "fs/promises";

async function run() {
  try {
    console.log("开始 GitLab 平台准备流程...");

    // 创建 GitLab 适配器
    const adapter = new GitLabAdapter();

    // 验证是否在 GitLab 环境中
    if (!adapter.isCurrentPlatform()) {
      throw new Error("当前不在 GitLab CI/CD 环境中运行");
    }

    // 解析 GitLab 上下文
    const context = adapter.parseContext();
    console.log(
      `解析到上下文: 项目 ${context.projectId}, 事件类型 ${context.eventType}`,
    );

    // 获取认证 token
    const gitlabToken = await adapter.getAuthToken();
    console.log("成功获取 GitLab 认证 token");

    // 创建 API 客户端
    const apiClient = adapter.createApiClient(gitlabToken);

    // 验证权限
    const hasPermissions = await adapter.validatePermissions(
      apiClient,
      context,
    );
    if (!hasPermissions) {
      throw new Error("用户没有足够的权限执行操作");
    }
    console.log("权限验证通过");

    // 检查触发条件
    let containsTrigger = false;

    // 检查不同类型的触发条件
    switch (context.eventType) {
      case "merge_request":
        if (context.mergeRequestIid) {
          // 检查合并请求中是否有触发短语
          const mr = await apiClient.getMergeRequest(context.mergeRequestIid);
          const triggerPhrase = context.inputs.triggerPhrase;

          // 检查标题和描述中是否包含触发短语
          containsTrigger =
            mr.title.includes(triggerPhrase) ||
            mr.description?.includes(triggerPhrase) ||
            false;

          console.log(
            `检查合并请求 ${context.mergeRequestIid}: 包含触发短语 "${triggerPhrase}": ${containsTrigger}`,
          );
        }
        break;

      case "issue":
        if (context.issueIid) {
          // 检查议题
          const issue = await apiClient.getIssue(context.issueIid);
          const triggerPhrase = context.inputs.triggerPhrase;

          containsTrigger =
            issue.title.includes(triggerPhrase) ||
            issue.description?.includes(triggerPhrase) ||
            false;

          console.log(
            `检查议题 ${context.issueIid}: 包含触发短语 "${triggerPhrase}": ${containsTrigger}`,
          );
        }
        break;

      case "pipeline":
      case "push":
        // 对于管道和推送事件，检查是否提供了明确的 prompt
        containsTrigger = Boolean(context.inputs.prompt);
        console.log(`管道/推送事件: 提供了提示词: ${containsTrigger}`);
        break;

      default:
        console.log(`未知事件类型: ${context.eventType}`);
        break;
    }

    // 创建环境变量文件供后续阶段使用
    const envVars = [
      `CONTAINS_TRIGGER=${containsTrigger}`,
      `GITLAB_PROJECT_ID=${context.projectId}`,
      `EVENT_TYPE=${context.eventType}`,
      `MERGE_REQUEST_IID=${context.mergeRequestIid || ""}`,
      `ISSUE_IID=${context.issueIid || ""}`,
      `PIPELINE_ID=${context.pipelineId || ""}`,
      `ACTOR=${context.actor}`,
      `PROMPT=${context.inputs.prompt}`,
      `TRIGGER_PHRASE=${context.inputs.triggerPhrase}`,
      `BASE_BRANCH=${context.inputs.baseBranch || "main"}`,
      `BRANCH_PREFIX=${context.inputs.branchPrefix}`,
      `USE_STICKY_COMMENT=${context.inputs.useStickyComment}`,
      `USE_COMMIT_SIGNING=${context.inputs.useCommitSigning}`,
      `ALLOWED_BOTS=${context.inputs.allowedBots}`,
    ].join("\n");

    await writeFile("prepare.env", envVars);
    console.log("环境变量已写入 prepare.env");

    // 设置 GitLab CI 输出变量
    console.log(`::set-output name=contains_trigger::${containsTrigger}`);
    console.log(`::set-output name=gitlab_token::${gitlabToken}`);
    console.log(`::set-output name=project_id::${context.projectId}`);

    if (!containsTrigger) {
      console.log("未检测到触发条件，跳过后续步骤");
      return;
    }

    console.log("准备阶段完成，将继续执行 Claude Code");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`准备阶段失败: ${errorMessage}`);

    // 写入错误状态
    await writeFile(
      "prepare.env",
      `PREPARE_ERROR=${errorMessage}\nCONTAINS_TRIGGER=false\n`,
    );
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
