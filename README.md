# Phquathi 的小站

基于 [Astro](https://astro.build) + [Fuwari](https://github.com/saicaca/fuwari)（MIT）主题的个人博客。

- 线上地址：<https://phquathi.github.io/pHq-blog/>
- 技术栈：Astro 5 · TypeScript · pnpm · Markdown · GitHub Actions · GitHub Pages
- 历史：2026-08 从旧 Hexo（yilia-plus 主题）站点迁移而来，旧文章与旧链接完整保留

## 特性

- Light / Dark 模式、主题色自定义
- 文章搜索（Pagefind）
- 文章目录 TOC、代码高亮（Expressive Code）
- 标签 / 分类 / 归档 / RSS / Sitemap
- 响应式布局、页面过渡动画
- 历史文章 URL（`/YYYY/MM/DD/<slug>/`）与新 URL（`/posts/<id>/`）同时可用

## 本地开发

```bash
pnpm install        # 安装依赖（首次）
pnpm dev            # 开发服务器 http://localhost:4321/pHq-blog/
pnpm check          # astro check 类型检查
pnpm build          # 生产构建到 dist/（含 pagefind 搜索索引）
pnpm preview        # 预览生产构建
pnpm format         # biome 格式化
pnpm lint           # biome lint
```

## 写一篇文章

1. 创建文章文件：

   ```bash
   pnpm new-post 2026-08-12-my-new-post
   ```

   生成 `src/content/posts/2026-08-12-my-new-post.md`。

2. 编辑 frontmatter 与正文：

   ```yaml
   ---
   title: "我的新文章"
   published: 2026-08-12
   description: "文章摘要"
   tags: ["技术"]
   category: "技术笔记"
   draft: false
   ---
   ```

3. 图片放到 `public/images/`，正文中用 `![alt](/images/xxx.png)` 引用。
4. `pnpm check && pnpm build` 通过后，commit 并 push 到 `master`，GitHub Actions 自动构建部署。

## 目录结构

```
src/
├── content/
│   ├── posts/        # 所有文章（Markdown）
│   └── spec/about.md # 关于页面内容
├── components/       # UI 组件
├── layouts/          # 布局
├── pages/            # 页面路由（含历史文章 URL 兜底）
├── config.ts         # 站点配置（标题/头像/导航/图标）
└── content/config.ts # frontmatter schema
public/
├── images/           # 站点与文章图片
└── favicon/          # 站点图标
scripts/
├── migrate-legacy-blog.ts  # 旧站迁移工具（审计用）
└── new-post.js             # 新建文章脚本
```

详细维护规则见 [AGENTS.md](./AGENTS.md)。

## 部署

push 到 `master` 后，`.github/workflows/deploy.yml` 自动执行：

```text
master → pnpm install → pnpm build → upload-pages-artifact → deploy-pages
```

无需手动运行部署命令，也不要提交 `dist/`。

## 迁移记录

2026-08-12 完成从 Hexo 静态站点到 Astro 的整体迁移，详见 [MIGRATION_REPORT.md](./MIGRATION_REPORT.md)。旧版全量备份在 tag `archive/pre-astro-migration-20260812`。
