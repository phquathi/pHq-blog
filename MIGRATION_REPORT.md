# MIGRATION_REPORT — Hexo → Astro 迁移报告

## 迁移日期

2026-08-12

## 原技术栈

- Hexo 静态站点（主题：hexo-theme-yilia-plus），仓库中仅有已生成的静态 HTML 产物（无 Hexo source）
- 发布方式：本地 `hexo deploy` / 手动提交生成后的静态文件

## 新技术栈

- Astro 5 + TypeScript + pnpm + Markdown
- 主题：Fuwari（MIT License，见根目录 LICENSE，保留上游许可信息）
- 部署：GitHub Actions → GitHub Pages（`.github/workflows/deploy.yml`）

## 迁移前备份

- Git tag：`archive/pre-astro-migration-20260812`（已推送至远程，指向迁移前的最后一个提交 b236977）
- 旧版静态站点全貌（全部文章 HTML、主题资源、live2d 模型等）可随时从该 tag 恢复

## 文章迁移

| 项目 | 数值 |
| --- | --- |
| 旧文章总数（扫描 2022/、2024/ 目录得到） | 25 |
| 成功转换（HTML → Markdown） | 25 |
| 转换失败 | 0 |
| 转换警告 | 6（均为同一篇文章中的 file:// 本地失效图片引用） |
| 迁移后 Markdown 文件 | 25（`src/content/posts/<YYYY-MM-DD>-<slug>.md`） |
| 新 URL（`/posts/<id>/`） | 25 |
| 旧 URL 保留（`/YYYY/MM/DD/<slug>/`，build 期静态生成） | 25 |

### 旧 URL 保留实现

- 每篇历史文章的 frontmatter 记录 `legacyPath`（如 `2024/07/07/外中断与内中断`）
- `src/pages/[...page].astro` 的 getStaticPaths 中为每个 legacyPath 生成静态路由，直接渲染文章正文（无 JS 跳转）
- 迁移一致性校验：标题 / 发布日期 / legacyPath / dist 路由 25/25 全部匹配，0 错误（见 `scripts/legacy-post-index.json`）

### 历史 URL 清单

```
https://phquathi.github.io/pHq-blog/2022/07/01/My-first-bolg/
https://phquathi.github.io/pHq-blog/2022/07/03/十年不悔-血战再开！/
https://phquathi.github.io/pHq-blog/2022/07/04/Java学习笔记（01）/
https://phquathi.github.io/pHq-blog/2022/07/05/acwing暑假每日一题（2022-7-5）/
https://phquathi.github.io/pHq-blog/2022/07/06/acwing暑假每日一题（2022-7-6）/
https://phquathi.github.io/pHq-blog/2022/07/06/Python学习总结（一）/
https://phquathi.github.io/pHq-blog/2022/07/07/acwing暑假每日一题（2022-7-7）/
https://phquathi.github.io/pHq-blog/2022/07/08/北华大学计算机程序设计算法提高训练营个人赛-签到题/
https://phquathi.github.io/pHq-blog/2024/05/20/RFID/
https://phquathi.github.io/pHq-blog/2024/05/20/单片机/
https://phquathi.github.io/pHq-blog/2024/05/20/图 Graph/
https://phquathi.github.io/pHq-blog/2024/05/20/物联网通信技术/
https://phquathi.github.io/pHq-blog/2024/05/23/C vs C++ Comparison/
https://phquathi.github.io/pHq-blog/2024/05/24/SCI索引数据库介绍/
https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？1/
https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？2/
https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？3/
https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？4/
https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？5/
https://phquathi.github.io/pHq-blog/2024/06/05/国产大模型评测/
https://phquathi.github.io/pHq-blog/2024/06/14/xhtml2pdf库之中文换行/
https://phquathi.github.io/pHq-blog/2024/06/18/深度学习入门(1)/
https://phquathi.github.io/pHq-blog/2024/06/18/深度学习入门(2)/
https://phquathi.github.io/pHq-blog/2024/06/18/深度学习入门(3)/
https://phquathi.github.io/pHq-blog/2024/07/07/外中断与内中断/
```

## 图片迁移

| 项目 | 数值 |
| --- | --- |
| 文章正文引用的图片 | 7 |
| 保留（外部 URL，无需迁移） | 1（gitee 图床图片，见《十年不悔-血战再开！》） |
| 缺失（file:// 本地失效路径，原文即无法显示） | 6（《国产大模型评测》中的 QQ 临时目录截图） |
| 个人资源迁移 | 4 |

个人资源迁移情况（原 `img/` → 新位置）：

| 原文件 | 用途 | 新位置 |
| --- | --- | --- |
| `-3cd35dc1bd8a18d7.gif` | 头像 | `src/assets/images/avatar.gif` |
| `bloodwar.png` | 侧栏背景（现作为站点 banner） | `src/assets/images/banner.png` |
| `apex.ico` | favicon | `public/favicon/apex.ico` |
| `1051367515.jpg` | QQ 联系方式图片 | `public/images/qq-contact.jpg` |

## 旧资源清理情况

删除的旧 Hexo 静态产物（全部可从备份 tag 恢复）：

- 文章 HTML 目录：`2022/`、`2024/`、`archives/`、`page/`
- 主题资源：`main.a5fda8.css/js`、`mobile.*.js`、`slider.*.js`、`fonts/`、`img/`（个人资源已迁移，其余为主题文件）
- 旧功能残留：`gitment/`（Gitment 评论）、`lib/`（clickLove/busuanzi 等）、`plugins/`（TweenMax/ribbon 等）、`live2d_models/`（全部 Live2D 模型，约 600+ 文件）
- `content.json`（旧 Hexo 文章索引）、根 `index.html`（旧首页）

未迁移的旧站功能（有意放弃）：自动播放音乐、点击爱心、Live2D 挂件、Gitment 评论、复杂侧栏。

## 本地检查结果

| 检查 | 结果 |
| --- | --- |
| `pnpm check`（astro check） | 通过（0 errors；Navbar/archive 两处 `@ts-expect-error` 为 Fuwari 上游 svelte client:only 类型误报，勿删） |
| `pnpm build`（astro build + pagefind） | 通过（56 页面；KaTeX 对历史文章个别 Unicode 字符的 warn 为正常现象） |
| `pnpm preview` 抽查 | 首页/归档/关于/RSS/分页 200；25 个旧 URL 全部 200 且正文完整；404 正常 |

## Git 提交

迁移共 5 个提交（自基线 b236977 起，均已推送至 origin/master）：

| Commit | 说明 |
| --- | --- |
| `a323a6f` | feat: migrate legacy blog posts to Markdown |
| `b6403ca` | feat: scaffold Astro blog with Fuwari theme |
| `3f33bbb` | ci: add GitHub Pages deploy workflow |
| `1d493b1` | docs: add agent guide, readme and migration report |
| `086a3d6` | chore: remove legacy Hexo static output |

## GitHub Actions 状态

- Workflow：`Deploy to GitHub Pages`（`.github/workflows/deploy.yml`）
- 首次运行（commit `086a3d6`，run 31572216633）：**success**
- GitHub Pages 构建源已通过 API 从 "Deploy from branch (master)" 切换为 "GitHub Actions"（build_type: workflow）
- 另有一条旧的 "pages build and deployment" 失败记录，是切换前旧分支部署方式的遗留，可忽略
- Actions 地址：https://github.com/phquathi/pHq-blog/actions

## 最终线上地址

- https://phquathi.github.io/pHq-blog/

## 已抽检的历史 URL（线上）

以下地址在部署完成后均验证返回 200 且正文完整：

- https://phquathi.github.io/pHq-blog/2024/07/07/外中断与内中断/
- https://phquathi.github.io/pHq-blog/2022/07/01/My-first-bolg/
- https://phquathi.github.io/pHq-blog/2022/07/03/十年不悔-血战再开！/（含外部图片）
- https://phquathi.github.io/pHq-blog/2024/05/23/C%20vs%20C++%20Comparison/（含空格路径）
- https://phquathi.github.io/pHq-blog/2024/05/20/图%20Graph/（含空格路径）
- https://phquathi.github.io/pHq-blog/2024/05/26/数字失忆：我们如何失去了中文互联网的历史？4/
- https://phquathi.github.io/pHq-blog/2024/06/18/深度学习入门(3)/
- https://phquathi.github.io/pHq-blog/2022/07/04/Java学习笔记（01）/

25 个旧 URL 全部在 build 期静态生成（见「历史 URL 清单」），新格式 URL `/posts/<id>/` 与 RSS、Pagefind 搜索、favicon 等资源同步验证正常。

## 仍需要处理的问题

1. 《国产大模型评测》一文有 6 张原为本地 file:// 路径的截图（QQ 临时目录），原文即无法显示；正文中以 HTML 注释保留了原路径信息。如手头还有原图，可补传到 `public/images/` 并替换正文引用。
2. 旧站曾使用 Gitee 图床（`gitee.com/phquathi/pic-tutu`），若该仓库失效，相关图片会失效；建议日后逐步把文章图片迁入 `public/images/`。
3. 旧站部分文章无标签/分类（原站即如此），未作猜测性补充；可随日后整理逐步补充。
