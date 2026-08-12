# AGENTS.md — pHq 博客维护指南

本文档面向 Coding Agent（以及未来的我），说明如何维护这个博客。**阅读本文档后，所有写博客/改博客的任务都应遵循这里的规则。**

## 项目概况

- 技术栈：Astro 5 + TypeScript + pnpm + Markdown(MD) + GitHub Pages
- 主题：基于 [Fuwari](https://github.com/saicaca/fuwari)（MIT License，见根目录 LICENSE）
- 线上地址：https://phquathi.github.io/pHq-blog/
- 发布方式：push 到 `master` 分支 → GitHub Actions 自动构建部署（无需手动 build / 提交 dist）
- 历史说明：2026-08 从旧 Hexo（yilia-plus 主题）静态站点整体迁移而来，旧文章与旧链接均已保留。

## 目录结构

```
src/
├── content/
│   ├── posts/        # 文章（Markdown），集中管理
│   └── spec/
│       └── about.md  # 关于页面内容
├── components/       # UI 组件（Fuwari 风格）
├── layouts/          # 页面布局
├── pages/            # 路由页面（首页/归档/关于/文章/旧链接兜底）
├── styles/           # 样式
├── utils/            # 工具函数（内容、URL 等）
├── config.ts         # 站点配置（标题、头像、导航、图标等）★ 个性化配置入口
└── content/config.ts # 文章 frontmatter schema

public/
├── images/           # 站点级静态图片
└── favicon/          # 站点图标

scripts/
├── migrate-legacy-blog.ts  # 旧站 HTML→Markdown 迁移工具（已废弃，仅供审计）
└── new-post.js             # 新建文章脚本

.github/workflows/deploy.yml  # 自动部署
```

## 文章存放位置

所有文章放在 `src/content/posts/`，一个文件一篇文章，扩展名 `.md`。

文件名规范（决定文章 ID 与 /posts/ 下的 URL）：

- 新文章：`<YYYY-MM-DD>-<英文或拼音slug>.md`，例如 `2026-08-12-astro-migration.md`
- 历史文章：`<YYYY-MM-DD>-<旧slug>.md`，例如 `2024-07-07-外中断与内中断.md`（**不要改历史文章文件名**，其 legacyPath 与旧链接绑定）

用脚本创建新文章：

```bash
pnpm new-post 2026-08-12-my-new-post
```

## Frontmatter Schema

```yaml
---
title: "文章标题"
published: 2026-08-12          # 必填，发布日期（历史文章必须保留原发布日期）
updated: 2026-08-13            # 可选，更新日期
description: "文章摘要"         # 可选，用于列表/SEO/RSS
image: ""                      # 可选，封面图（放 public/ 或 src/assets）
tags: ["标签1", "标签2"]        # 可选
category: ""                   # 可选，例如 "技术笔记" / "随笔"
draft: false                   # true = 本地可见、生产构建不发布
lang: ""                       # 可选，默认取站点语言
legacyPath: "2024/07/07/外中断与内中断"  # 仅历史文章有，勿动！
---
```

校验规则见 `src/content/config.ts`。

## 历史文章 URL 兼容规则（重要）

旧站文章地址形如 `https://phquathi.github.io/pHq-blog/2024/07/07/外中断与内中断/`。

实现方式：

- 历史文章的 frontmatter 中 `legacyPath` 记录旧路径（不带首尾斜杠）
- `src/pages/[...page].astro` 在 build 期直接为每个 legacyPath 生成静态页面（`/YYYY/MM/DD/<slug>/`），内容与原文章一致
- **新增/修改文章时不要改动历史文章的 legacyPath**；新文章不需要 legacyPath

历史链接同时兼容：`/posts/<文件名>/`（新格式）与 `/YYYY/MM/DD/<slug>/`（旧格式）。

## 旧文章发布时间规则

- 历史文章 `published` 必须等于原发布日期（迁移时已从旧站 meta 恢复，见 legacy-post-index.json / MIGRATION_REPORT.md）
- 不要用迁移日期或当前日期覆盖历史文章的发布时间

## 文章图片规范

- 文章正文图片优先放在 `public/images/` 下（GitHub Pages 子路径 `/pHq-blog/` 下可正常加载）
- 引用时写以 `/` 开头的站内路径即可，例如 `![](/images/posts/xxx/图1.png)`——构建时 `remark-rewrite-internal-links` 插件会自动补上 `/pHq-blog` base（`src/plugins/remark-rewrite-internal-links.js`，base 在 `astro.config.mjs` 的 `SITE_BASE` 注入）
- 外部完整 URL（http/https 或 `//` 开头）不会被重写，可以直接使用
- 不要使用 `http://localhost` 或本地绝对路径引用图片

## 新文章创建规范

1. 先与用户确认：标题、标签、分类、是否草稿
2. 用 `pnpm new-post <文件名>` 创建，或直接手写 Markdown 文件
3. 按上文 frontmatter schema 填写（含 description）
4. 正文用标准 Markdown；代码块用 ```lang 围栏；数学公式用 `$...$` / `$$...$$`（KaTeX 支持）
5. 图片放到 `public/images/` 并在正文引用
6. `draft: true` 时可本地预览；确认发布时改为 `false` 或直接删除该字段
7. 运行检查：`pnpm check`（可选 `pnpm build`）

## 本地开发命令

```bash
pnpm install        # 安装依赖（首次）
pnpm dev            # 本地开发 http://localhost:4321/pHq-blog/
pnpm preview        # 预览生产构建（先 build）
```

## 质量检查

```bash
pnpm check          # astro check（类型检查，必须通过）
pnpm build          # 生产构建 + pagefind 搜索索引（必须通过）
pnpm format         # biome 格式化 src/
pnpm lint           # biome lint src/
```

已知事项：

- `pnpm build` 中 KaTeX 对个别 Unicode 字符的 warn 提示为正常现象（历史文章中的数学符号）
- `pnpm check` 在 Navbar.astro / archive.astro 有两处 `@ts-expect-error` 注释，是 Fuwari 上游 svelte `client:only` 的类型误报，**不要删除这些注释**

## 发布流程

1. 修改文章/代码
2. `pnpm check && pnpm build` 通过
3. `git add` 相关文件并 commit（message 简洁清晰，例如 `feat: 新增文章 xxx`）
4. `git push origin master`
5. GitHub Actions 自动执行 `.github/workflows/deploy.yml`，完成后线上更新

不需要手动运行部署命令，也不要提交 `dist/`。

## 常见陷阱

- 站点运行在 `/pHq-blog/` 子路径：所有内部链接/资源请用 `url()` 工具或相对 base 写法，不要硬编码 `/xxx`
- 历史文章（legacyPath 非空）只允许修改正文内容，不允许改文件名与 legacyPath
- 不要删除 `src/pages/[...page].astro` 中的 legacy 分支，否则旧链接全部失效
- 备份旧 Hexo 站点的 tag：`archive/pre-astro-migration-20260812`（可随时恢复旧版全貌）
