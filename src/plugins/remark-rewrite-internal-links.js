/**
 * remark-rewrite-internal-links.js
 *
 * Markdown 中的站内绝对路径（如 /images/xxx.png、/about/）在站点运行于子路径（/pHq-blog/）时
 * 会被浏览器解析到域名根目录而 404。本插件在 mdast 阶段把图片/链接的站内路径重写为带 base 的路径。
 *
 * 用法（astro.config.mjs）：
 *   markdown: { remarkPlugins: [..., [remarkRewriteInternalLinks, { base: "/pHq-blog" }]] }
 */
import { visit } from "unist-util-visit";

export function remarkRewriteInternalLinks(options) {
	const prefix = options?.base?.replace(/\/$/, "");
	return (tree) => {
		if (!prefix || prefix === "") return;
		visit(tree, ["image", "link"], (node) => {
			const url = node.url;
			if (
				typeof url !== "string" ||
				!url.startsWith("/") ||
				url.startsWith("//") ||
				url.startsWith(prefix)
			) {
				return;
			}
			node.url = prefix + url;
		});
	};
}
