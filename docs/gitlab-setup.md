# GitLab 平台适配设置指南

本指南将帮助您在 GitLab 项目中设置和配置 Claude Code，实现与 GitHub Actions 类似的自动化功能。

## 前置要求

1. GitLab 项目（GitLab.com 或自托管实例）
2. 项目的 Maintainer 或 Owner 权限
3. GitLab 访问令牌

## 设置步骤

### 1. 获取 GitLab 访问令牌

创建一个具有适当权限的访问令牌：

#### 选项 A：个人访问令牌 (PAT)

1. 访问 GitLab Settings > Access Tokens
2. 创建新令牌，选择以下权限：
   - `api` - 完整 API 访问
   - `read_repository` - 读取仓库
   - `write_repository` - 写入仓库

#### 选项 B：项目访问令牌（推荐）

1. 访问项目 Settings > Access Tokens
2. 创建新令牌，选择以下权限：
   - `api` - 完整 API 访问
   - `read_repository` - 读取仓库
   - `write_repository` - 写入仓库
   - `maintainer` 角色

### 2. 配置项目变量

在项目 Settings > CI/CD > Variables 中添加：

#### 必需变量

- `CLAUDE_GITLAB_TOKEN` - 您的 GitLab 访问令牌（标记为 Masked 和 Protected）

#### 可选变量

- `TRIGGER_PHRASE` - 触发短语（默认：`@claude`）
- `BRANCH_PREFIX` - 分支前缀（默认：`claude/`）
- `USE_STICKY_COMMENT` - 使用固定评论（`true`/`false`）
- `ALLOWED_BOTS` - 允许的机器人列表

### 3. 添加 GitLab CI/CD 配置

将本项目中的 `.gitlab-ci.yml` 文件复制到您的项目根目录。

### 4. 配置 Claude Code

确保您的项目包含必要的 Claude Code 文件：

```bash
# 复制平台适配文件
cp -r src/platforms/ your-project/src/
cp -r src/mcp/gitlab-* your-project/src/mcp/
cp src/entrypoints/prepare-gitlab.ts your-project/src/entrypoints/
```

## 使用方式

### 在合并请求中使用

1. 创建合并请求
2. 在标题或描述中包含触发短语（默认 `@claude`）
3. 或者在合并请求评论中提及 `@claude`

示例：

```markdown
@claude 请帮我优化这个函数的性能
```

### 手动触发

1. 访问 CI/CD > Pipelines
2. 点击 "Run pipeline"
3. 设置变量 `PROMPT` 为您的请求
4. 运行管道

### 议题分配触发

通过 GitLab Webhooks 配置议题分配触发：

1. 访问项目 Settings > Webhooks
2. 添加新 webhook，URL 指向触发管道的端点
3. 选择 "Issues events"
4. 配置过滤条件

## 支持的功能

### ✅ 已实现

- 合并请求评论和更新
- 文件创建和修改
- 分支创建和管理
- 权限验证
- GitLab API 集成

### 🚧 开发中

- 议题评论
- Webhook 触发器
- 高级工作流

### ❌ 暂不支持

- GitLab Pages 部署
- Container Registry 集成

## 配置示例

### 基础配置

```yaml
# .gitlab-ci.yml
include:
  - project: "your-group/claude-code-action"
    file: ".gitlab-ci.yml"

variables:
  TRIGGER_PHRASE: "@claude-bot"
  BRANCH_PREFIX: "ai-assist/"
```

### 高级配置

```yaml
# .gitlab-ci.yml
variables:
  TRIGGER_PHRASE: "@claude"
  USE_STICKY_COMMENT: "true"
  ALLOWED_BOTS: "gitlab-bot,dependabot"
  DEBUG_MODE: "true" # 启用调试模式

claude_execute:
  extends: .claude_base
  rules:
    - if: "$CI_MERGE_REQUEST_IID && $CI_MERGE_REQUEST_TITLE =~ /@claude/"
  timeout: 45 minutes # 自定义超时
```

## 故障排除

### 常见问题

**Q: Pipeline 失败，提示权限错误**
A: 检查 `CLAUDE_GITLAB_TOKEN` 是否正确设置，且令牌有足够权限。

**Q: 未检测到触发条件**  
A: 确保合并请求标题、描述或评论中包含正确的触发短语。

**Q: 分支创建失败**
A: 检查令牌是否有 `write_repository` 权限，且用户有推送权限。

### 调试模式

启用调试模式获取更多日志：

```yaml
variables:
  DEBUG_MODE: "true"
  CI_DEBUG_TRACE: "true"
```

### 日志查看

1. 访问 CI/CD > Pipelines
2. 点击失败的 pipeline
3. 查看各阶段的详细日志

## API 差异说明

GitLab API 与 GitHub API 的主要差异：

| 功能     | GitHub API                   | GitLab API                          |
| -------- | ---------------------------- | ----------------------------------- |
| 认证     | `Authorization: Bearer`      | `PRIVATE-TOKEN`                     |
| 合并请求 | `/repos/owner/repo/pulls`    | `/projects/:id/merge_requests`      |
| 评论     | `issue_comment`              | `notes`                             |
| 分支     | `/repos/owner/repo/git/refs` | `/projects/:id/repository/branches` |

## 安全考虑

1. 使用项目访问令牌而不是个人令牌
2. 将令牌标记为 Protected 和 Masked
3. 定期轮换访问令牌
4. 限制令牌权限到最小必需

## 贡献

如果您发现问题或有改进建议，请：

1. 提交 Issue 描述问题
2. 创建合并请求提供修复
3. 更新文档

## 许可证

本适配遵循与原 Claude Code Action 相同的许可证。
