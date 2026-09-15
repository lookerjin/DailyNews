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

推荐的 Issue Body：

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

Frontmatter 是可选的。缺失时 DailyNews 会使用 Issue 创建时间和 `task:*` Label 做兜底。

建议同时增加一个任务 Label：

```text
task:github-trending
task:ai-news
task:weekly-reading
```

## 给定时任务的最小提示

可以在现有定时任务最后追加：

```text
完成本次内容后，在 GitHub 仓库 lookerjin/DailyNews 创建一个 Issue。
一个 Issue 代表本次任务的一次运行结果。
标题使用“[任务名称] YYYY-MM-DD - 今日核心主题”。
正文顶部使用 DailyNews README 约定的 YAML Frontmatter，正文保留完整 Markdown 结果。
为 Issue 添加 task:<task-id> 标签。
```

如果调用方暂时不能创建 Label，只写 Frontmatter 里的 `task` 也可以正常展示。

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
2. 解析 Frontmatter 和 Markdown。
3. 生成 `public/issues.json`。
4. 使用 Vite 构建静态站点。
5. 部署到 GitHub Pages。

首次使用时，需要在仓库 **Settings → Pages** 中确认 Build and deployment 的 Source 使用 **GitHub Actions**。之后新增 Issue 就会自动刷新页面。

## 设计原则

- **Issue 是事实源**：Pages 坏了，历史数据仍然完整存在 GitHub。
- **展示层可替换**：未来换前端框架不会影响数据。
- **Agent 无关**：谁创建 Issue 不重要，只要遵循很薄的数据协议。
- **先保证可运行**：没有 Frontmatter 也能展示，格式错误不应该让整个信息流失效。
