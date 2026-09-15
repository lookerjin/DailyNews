# DailyNews

DailyNews 是一个由 **GitHub Issues 驱动的个人信息时间线**。

定时任务、Agent 或任何自动化工具只负责把结果写成 Issue；GitHub 保存历史、提供搜索和标签，GitHub Pages 负责把这些 Issue 变成更适合每天阅读的时间线。

```text
ChatGPT / Codex / Claude / Agent
              │
              │ create issue
              ▼
        GitHub Issues
              │
              │ GitHub Actions
              ▼
        GitHub Pages
```

不需要数据库，不需要长期运行的服务器，也不绑定某一个 Agent 平台。

## 数据模型

一个 Issue 代表一个任务的一次运行结果。

发布到 DailyNews 的 Issue Body：

```markdown
---
task: github-trending
task_name: GitHub Trending
category: AI Coding
date: 2026-09-15
generated_at: 2026-09-15T10:00:00+08:00
type: daily
status: success
summary: 今天有 4 个 Agent / AI Coding 项目值得关注。
---

## 今日观察

正文继续使用普通 Markdown。

### example/repo

为什么值得关注……

## Sources

- https://github.com/example/repo
```

当前发布规则很简单：

- Issue 必须由仓库 owner 创建。
- Body 必须包含可解析的 YAML Frontmatter。
- `task` 必须是非空字符串。
- `date`、`generated_at`、`summary` 等字段格式异常时会记录构建 warning，并使用安全兜底值。
- 普通 GitHub Issue、无法解析的 Frontmatter 或缺少 `task` 的 Issue 不会进入 DailyNews 页面，也不会阻断其他正常内容的构建。

Label 不是发布所必需的；如果调用方方便，也可以继续增加 `task:*` Label 作为 GitHub 侧的辅助分类：

```text
task:github-trending
task:ai-news
task:weekly-reading
```

> 当前仓库是公开仓库，因此先使用“owner + Frontmatter”作为最小发布边界。未来如果真实接入独立 Bot，再根据实际需要扩展可信作者范围。

## 给定时任务的最小提示

可以在现有定时任务最后追加：

```text
完成本次内容后，在 GitHub 仓库 lookerjin/DailyNews 创建一个 Issue。
一个 Issue 代表本次任务的一次运行结果。
标题使用“[任务名称] YYYY-MM-DD - 今日核心主题”。
正文顶部使用 DailyNews README 约定的 YAML Frontmatter，正文保留完整 Markdown 结果。
```

## 页面

- `/`：跨任务 Timeline
- `#/task/<task-id>`：某个任务的历史记录
- `#/issue/<number>`：单条结果详情

使用 Hash Router，因此 GitHub Pages 刷新详情页不需要额外的 404 重写。

## 本地开发

要求 Node.js 22+。

```bash
npm install
npm run fetch:issues
npm run dev
```

公开仓库在没有 `GITHUB_TOKEN` 时也可以抓取 Issues；GitHub Actions 构建时会自动使用仓库自带的 `GITHUB_TOKEN`。

构建：

```bash
npm run build
```

## 部署

`.github/workflows/pages.yml` 会在以下情况重新构建：

- `main` 有代码更新
- Issue 创建、编辑、关闭、重新打开或标签变化
- 手动触发 workflow

Workflow 会：

1. 拉取仓库全部 Issues。
2. 筛选符合发布边界的 Issue，并解析 Frontmatter 和 Markdown。
3. 对异常字段做 warning 与兜底，跳过不合法的发布内容。
4. 生成 `public/issues.json`。
5. 使用 Vite 构建静态站点。
6. 部署到 GitHub Pages。

首次使用时，需要在仓库 **Settings → Pages** 中确认 Build and deployment 的 Source 使用 **GitHub Actions**。之后新增 Issue 就会自动刷新页面。

## 设计原则

- **Issue 是事实源**：Pages 坏了，历史数据仍然完整存在 GitHub。
- **展示层可替换**：未来换前端框架不会影响数据。
- **上游工具可替换**：调用方不重要，只要最终由可信发布身份写入符合协议的 Issue。
- **坏数据不拖垮整站**：异常内容被跳过或字段回退，正常内容继续构建。
- **只解决已经出现的问题**：在真实运行中发现边界，再按实际反馈增加能力，避免提前引入不必要的基础设施。
