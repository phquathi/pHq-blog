/**
 * migrate-legacy-blog.ts
 *
 * 将旧 Hexo (yilia-plus) 静态输出中的文章 HTML 迁移为 Astro Markdown。
 *
 * 用法（在仓库根目录）:
 *   node scripts/migrate-legacy-blog.ts
 *
 * 前置条件: 仓库根目录下存在旧版 Hexo 生成的 2022/、2024/ 目录。
 * 历史备份见 tag: archive/pre-astro-migration-20260812
 *
 * 输出:
 *   src/content/posts/<YYYY-MM-DD>-<slug>.md   迁移后的文章
 *   scripts/legacy-post-index.json              迁移索引与统计
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "src", "content", "posts");
const INDEX_FILE = path.join(ROOT, "scripts", "legacy-post-index.json");
const POST_DIR_RE = /(^|\/)\d{4}\/\d{2}\/\d{2}\/[^/]+$/;

interface LegacyPost {
  dir: string;
  legacyPath: string;
  title: string;
  published: string;
  description: string;
  bodyHtml: string;
}

interface PostResult {
  dir: string;
  legacyPath: string;
  title: string;
  published: string;
  description: string;
  outFile: string;
  status: "ok" | "failed";
  warnings: string[];
  images: { src: string; status: "kept" | "missing" | "skipped" }[];
}

/* ------------------------------------------------------------------ */
/*  HTML entity 解码                                                    */
/* ------------------------------------------------------------------ */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  copy: "\u00a9",
  reg: "\u00ae",
  times: "\u00d7",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  laquo: "\u00ab",
  raquo: "\u00bb",
  middot: "\u00b7",
  rarr: "\u2192",
  larr: "\u2190",
  uarr: "\u2191",
  darr: "\u2193",
  trade: "\u2122",
  deg: "\u00b0",
  plusmn: "\u00b1",
  minus: "\u2212",
  ne: "\u2260",
  le: "\u2264",
  ge: "\u2265",
  in: "\u2208",
  notin: "\u2209",
  sqrt: "\u221a",
  infin: "\u221e",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (whole, body: string) => {
      if (body[0] === "#") {
        const code =
          body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
        if (!Number.isNaN(code) && code > 0 && code <= 0x10ffff) {
          try {
            return String.fromCodePoint(code);
          } catch {
            return whole;
          }
        }
        return whole;
      }
      return NAMED_ENTITIES[body] ?? whole;
    },
  );
}

/* ------------------------------------------------------------------ */
/*  迷你 HTML tokenizer                                                 */
/* ------------------------------------------------------------------ */
interface Token {
  type: "text" | "tag";
  text: string;
  name: string;
  attrs: Record<string, string>;
  close: boolean;
  selfClosing: boolean;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      tokens.push({ type: "text", text: html.slice(i), name: "", attrs: {}, close: false, selfClosing: false });
      break;
    }
    if (lt > i) {
      tokens.push({ type: "text", text: html.slice(i, lt), name: "", attrs: {}, close: false, selfClosing: false });
    }
    // comment
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      tokens.push({ type: "text", text: html.slice(lt), name: "", attrs: {}, close: false, selfClosing: false });
      break;
    }
    const raw = html.slice(lt + 1, gt).trim();
    let close = false;
    let inner = raw;
    if (inner.startsWith("/")) {
      close = true;
      inner = inner.slice(1).trim();
    }
    const mName = inner.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
    if (!mName) {
      // malformed tag, treat as text
      tokens.push({ type: "text", text: html.slice(lt, gt + 1), name: "", attrs: {}, close: false, selfClosing: false });
      i = gt + 1;
      continue;
    }
    const name = mName[1].toLowerCase();
    const selfClosing = /\/\s*$/.test(inner) || SELF_CLOSING.has(name);
    const attrs: Record<string, string> = {};
    const rest = inner.slice(mName[0].length);
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(rest))) {
      const key = am[1].toLowerCase();
      const value = am[2] ?? am[3] ?? am[4] ?? "";
      attrs[key] = decodeEntities(value);
    }
    tokens.push({ type: "tag", text: raw, name, attrs, close, selfClosing });
    i = gt + 1;
  }
  return tokens;
}

const SELF_CLOSING = new Set(["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"]);

/* ------------------------------------------------------------------ */
/*  HTML -> Markdown 转换器                                            */
/* ------------------------------------------------------------------ */
interface ConvertContext {
  warnings: string[];
  images: PostResult["images"];
}

function stripTags(html: string): string {
  const tokens = tokenize(html);
  let out = "";
  for (const t of tokens) {
    if (t.type === "text") out += t.text;
    else if (t.name === "br") out += "\n";
  }
  return decodeEntities(out);
}


function escapeInline(text: string): string {
  return text.replace(/([\\*_`\[\]])/g, "\\$1");
}


/* ------------------------------------------------------------------ */
/*  行内元素解析器（持有独立 token 流）                                  */
/* ------------------------------------------------------------------ */
class InlineParser {
  private tokens: Token[];
  private pos = 0;
  private ctx: ConvertContext;

  constructor(html: string, ctx: ConvertContext) {
    this.tokens = tokenize(html);
    this.ctx = ctx;
  }

  convert(): string {
    let out = "";
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (t.type === "text") {
        out += escapeInline(decodeEntities(t.text));
        this.pos++;
        continue;
      }
      this.pos++;
      if (t.close) continue;
      switch (t.name) {
        case "br":
          out += "  \n";
          break;
        case "strong":
        case "b":
          out += "**" + this.parseNested(t.name) + "**";
          break;
        case "em":
        case "i":
          out += "*" + this.parseNested(t.name) + "*";
          break;
        case "del":
        case "s":
          out += "~~" + this.parseNested(t.name) + "~~";
          break;
        case "u":
          out += `<u>${this.parseNested("u")}</u>`;
          break;
        case "code":
          out += "`" + this.parseNested("code").replace(/`/g, "\\`") + "`";
          break;
        case "a": {
          const href = t.attrs["href"] || "";
          const title = t.attrs["title"] || "";
          const inner = this.parseNested("a");
          if (href.startsWith("#") && inner === "") break; // hexo headerlink 锚点
          const innerText = inner || href;
          let mdA = `[${innerText}](${href})`;
          if (title) mdA = `[${innerText}](${href} "${title.replace(/"/g, '\\"')}")`;
          out += mdA;
          break;
        }
        case "img": {
          const src = t.attrs["src"] || "";
          const alt = t.attrs["alt"] || "";
          if (/pan\.baidu\.com\/share\/qrcode/.test(src)) {
            this.ctx.warnings.push(`skipped theme qrcode image: ${src.slice(0, 80)}`);
            break;
          }
          if (/^file:\/\//.test(src)) {
            this.ctx.warnings.push(`local file image cannot be migrated: ${src}`);
            this.ctx.images.push({ src, status: "missing" });
            out += `<!-- 原文章图片（本地文件，无法迁移）: ${escapeInline(src)} -->\n`;
            break;
          }
          this.ctx.images.push({ src, status: "kept" });
          out += `![${alt.replace(/[\[\]\\]/g, "")}](${src})`;
          break;
        }
        case "span":
          out += this.parseNested("span");
          break;
        case "sub":
          out += "<sub>" + this.parseNested("sub") + "</sub>";
          break;
        case "sup":
          out += "<sup>" + this.parseNested("sup") + "</sup>";
          break;
        case "iframe":
          out += `<iframe${this.rawAttrs(t)}></iframe>`;
          break;
        case "abbr":
          out += this.parseNested("abbr");
          break;
        default:
          out += this.parseNested(t.name);
      }
    }
    return out;
  }

  /** 收集 name 元素的内部原始 HTML，并递归解析为行内 md */
  private parseNested(name: string): string {
    const stack: string[] = [name];
    let out = "";
    while (this.pos < this.tokens.length) {
      const t = this.next();
      if (t.type === "text") {
        out += t.text;
        continue;
      }
      if (t.close) {
        const top = stack[stack.length - 1];
        if (t.name === top) {
          stack.pop();
          if (top === name && stack.length === 0) break;
          out += "</" + t.name + ">"; // 保留嵌套元素闭合标签，维持原始 HTML 平衡
          continue;
        }
        out += "</" + t.name + ">"; // 不配对 close，保留原始
        continue;
      }
      if (t.selfClosing) {
        out += this.serializeTag(t);
        continue;
      }
      stack.push(t.name);
      out += this.serializeTag(t);
    }
    if (out === "") return "";
    return new InlineParser(out, this.ctx).convert();
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private rawAttrs(t: Token): string {
    return Object.entries(t.attrs)
      .map(([k, v]) => ` ${k}="${v.replace(/"/g, "&quot;")}"`)
      .join("");
  }

  private serializeTag(t: Token): string {
    return `<${t.name}${this.rawAttrs(t)}>`;
  }
}

/* ------------------------------------------------------------------ */
/*  块级 HTML -> Markdown 转换器                                       */
/* ------------------------------------------------------------------ */
class Converter {
  private tokens: Token[];
  private pos = 0;
  private ctx: ConvertContext;

  constructor(html: string, ctx: ConvertContext) {
    this.tokens = tokenize(html);
    this.ctx = ctx;
  }

  convert(): string {
    const parts: string[] = [];
    while (this.pos < this.tokens.length) {
      const t = this.tokens[this.pos];
      if (t.type === "text") {
        if (/\S/.test(t.text)) parts.push(new InlineParser(t.text, this.ctx).convert() + "\n\n");
        this.pos++;
        continue;
      }
      const block = this.block();
      if (block !== null && block !== "") parts.push(block + "\n\n");
    }
    // 正文中剩余 h1 降级为 h2（页面标题已由 frontmatter 提供）
    return parts
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^# (.+)$/gm, "## $1")
      .trim();
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private block(): string | null {
    const t = this.next();
    if (t.type === "text") return new InlineParser(t.text, this.ctx).convert();
    if (t.close || t.selfClosing) return "";
    switch (t.name) {
      case "p": {
        const inner = this.collectUntil("p");
        const text = new InlineParser(inner, this.ctx).convert().trim();
        return text || null;
      }
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(t.name[1]);
        const content = new InlineParser(this.collectUntil(t.name).trim(), this.ctx).convert().trim();
        return `${"#".repeat(level)} ${content}`;
      }
      case "figure":
        return this.figure(t);
      case "pre": {
        const code = stripTags(this.collectUntil("pre"));
        return "```\n" + code.trim() + "\n```";
      }
      case "ul":
        return this.list(t, false);
      case "ol":
        return this.list(t, true);
      case "blockquote": {
        const inner = this.collectUntil("blockquote");
        const md = new Converter(inner, this.ctx).convert();
        return md
          .split("\n")
          .map((line) => (line.trim() ? `> ${line}` : ">"))
          .join("\n");
      }
      case "table":
        return this.table(t);
      case "hr":
        return "---";
      case "br":
        return "";
      case "div":
      case "section": {
        const inner = this.collectUntil(t.name);
        const md = new Converter(inner, this.ctx).convert();
        return md || null;
      }
      case "iframe":
        return `<iframe${this.rawAttrs(t)}></iframe>`;
      default:
        return new InlineParser(this.collectTextUntil(t.name), this.ctx).convert();
    }
  }

  private rawAttrs(t: Token): string {
    return Object.entries(t.attrs)
      .map(([k, v]) => ` ${k}="${v.replace(/"/g, "&quot;")}"`)
      .join("");
  }

  private serializeTag(t: Token): string {
    return `<${t.name}${this.rawAttrs(t)}>`;
  }

  /** collect tokens of same-name element until matching close */
  private collectUntil(name: string): string {
    const stack: string[] = [name];
    let out = "";
    while (this.pos < this.tokens.length) {
      const t = this.next();
      if (t.type === "text") {
        out += t.text;
        continue;
      }
      if (t.close) {
        const top = stack[stack.length - 1];
        if (t.name === top) {
          stack.pop();
          if (top === name && stack.length === 0) break;
          out += "</" + t.name + ">"; // 保留嵌套元素闭合标签，维持原始 HTML 平衡
          continue;
        }
        out += "</" + t.name + ">"; // 不配对 close，保留原始
        continue;
      }
      if (t.selfClosing) {
        if (t.name === "br") out += "\n";
        else out += this.serializeTag(t);
        continue;
      }
      stack.push(t.name);
      out += this.serializeTag(t);
    }
    return out;
  }

  private collectTextUntil(name: string): string {
    return stripTags(this.collectUntil(name));
  }

  private figure(t: Token): string {
    // hexo highlight: <figure class="highlight LANG"><table>...<td class="code"><pre>...</pre></td>...
    const lang = (t.attrs["class"] || "").replace("highlight", "").trim();
    const inner = this.collectUntil("figure");
    const codeTd = inner.match(/<td class="code"[^>]*>([\s\S]*?)<\/td>/);
    const pre = codeTd ? codeTd[1] : inner.match(/<pre>([\s\S]*?)<\/pre>/)?.[1] ?? "";
    const code = stripTags(pre)
      .split("\n")
      .map((l) => l.replace(/\s+$/g, ""))
      .join("\n")
      .replace(/\n+$/g, "")
      .replace(/^\s*\n/g, "");
    return `\`\`\`${lang}\n${code}\n\`\`\``;
  }

  private list(t: Token, ordered: boolean): string {
    const inner = this.collectUntil(t.name);
    const tokens = tokenize(inner);
    // 找出所有顶层 <li> 的起止区间（忽略嵌套列表内部的 li）
    const liStarts: number[] = [];
    const stack: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.type !== "tag") continue;
      if (!tk.close) {
        if (tk.name === "li") {
          if (stack.length === 0) liStarts.push(i);
          stack.push("li");
        } else if (tk.name === "ul" || tk.name === "ol") {
          stack.push(tk.name);
        }
        if (tk.selfClosing) stack.pop();
      } else {
        stack.pop();
      }
    }
    if (liStarts.length === 0) return "";
    const lines: string[] = [];
    for (let k = 0; k < liStarts.length; k++) {
      const start = liStarts[k];
      const end = k + 1 < liStarts.length ? liStarts[k + 1] : tokens.length;
      const itemHtml = tokens
        .slice(start, end)
        .map((x) => (x.type === "text" ? x.text : `<${x.text}>`))
        .join("");
      // 提取 item 中的嵌套列表（首个 <ul/<ol 到末尾）
      const nestedMatch = itemHtml.match(/(<ul|<ol)[\s\S]*/);
      let itemBody = itemHtml;
      let nestedMd = "";
      if (nestedMatch) {
        const nn = nestedMatch[0];
        const sub = new Converter(nn, this.ctx);
        nestedMd =
          "\n" +
          sub
            .convert()
            .split("\n")
            .map((l) => "    " + l)
            .join("\n") +
          "\n";
        itemBody = itemHtml.slice(0, itemHtml.length - nn.length);
      }
      const marker = ordered ? `${k + 1}. ` : "- ";
      const text = new InlineParser(itemBody, this.ctx).convert().trim();
      lines.push(marker + text + nestedMd);
    }
    return lines.join("\n");
  }

  private table(t: Token): string {
    const inner = this.collectUntil("table");
    const rows: string[][] = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let rm: RegExpExecArray | null;
    while ((rm = rowRe.exec(inner))) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[1]))) {
        cells.push(new InlineParser(cm[1], this.ctx).convert().trim().replace(/\|/g, "\\|"));
      }
      rows.push(cells);
    }
    if (rows.length === 0) return "";
    const width = Math.max(...rows.map((r) => r.length));
    const md: string[] = [];
    md.push(`| ${rows[0].concat(Array(width - rows[0].length).fill("")).join(" | ")} |`);
    md.push(`| ${Array(width).fill("---").join(" | ")} |`);
    for (const row of rows.slice(1)) {
      md.push(`| ${row.concat(Array(width - row.length).fill("")).join(" | ")} |`);
    }
    return md.join("\n");
  }
}


function extractArticleBody(html: string, warnings: string[]): string {
  const m = html.match(/<div class="article-entry"[^>]*>([\s\S]*?)(?=<div class="clearfix"|<div class="declare")/);
  if (m) return m[1];
  warnings.push("article-entry div not found, using <article> fallback");
  const am = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  if (!am) throw new Error("no article element found");
  return am[1];
}

function normalizeTitle(text: string): string {
  return decodeEntities(stripTags(text)).replace(/\s+/g, " ").trim();
}

function extractTitle(html: string, bodyHtml: string): string {
  const m = html.match(/<h1 class="article-title"[^>]*>([\s\S]*?)<\/h1>/);
  if (m) return normalizeTitle(m[1]);
  const h1 = bodyHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) return normalizeTitle(h1[1]);
  return "";
}

function extractPublished(html: string): string {
  const m = html.match(/article:published_time" content="([^"]+)"/);
  if (m) return m[1];
  const t = html.match(/itemprop="datePublished"[^>]*datetime="([^"]+)"/);
  if (t) return t[1];
  return "";
}

function extractDescription(html: string, bodyHtml: string): string {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  if (m && m[1].trim()) return decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  const text = stripTags(bodyHtml).replace(/\s+/g, " ").trim();
  return text.slice(0, 120);
}

function cleanBody(bodyHtml: string, title: string): string {
  let html = bodyHtml;
  // 移除 hexo more 标记
  html = html.replace(/<span[^>]*id="more"[^>]*><\/span>/g, "");
  // 移除与标题重复的正文 h1（2024 文章正文首 h1 即标题）
  const h1 = html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (h1) {
    const h1Title = normalizeTitle(h1[1]);
    if (h1Title && normalizeTitle(title) === h1Title) {
      html = html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");
    }
  }
  // 移除 html 注释
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  return html;
}

function toFrontmatterYaml(post: { title: string; published: string; description: string; legacyPath: string }): string {
  const q = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
  const lines = [
    "---",
    `title: ${q(post.title)}`,
    `published: ${post.published}`,
    `description: ${q(post.description)}`,
    "tags: []",
    'category: ""',
    "draft: false",
    `legacyPath: ${q(post.legacyPath)}`,
    "---",
  ];
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  main                                                               */
/* ------------------------------------------------------------------ */
function discoverPosts(): LegacyPost[] {
  const posts: LegacyPost[] = [];
  const candidates: string[] = [];
  for (const year of ["2022", "2024"]) {
    const yearDir = path.join(ROOT, year);
    if (!fs.existsSync(yearDir)) continue;
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "index.html" && POST_DIR_RE.test(p.replace(/\\/g, "/").replace(/\/index\.html$/, ""))) {
          candidates.push(path.relative(ROOT, dir).replace(/\\/g, "/"));
        }
      }
    };
    walk(yearDir);
  }
  for (const dir of candidates.sort()) {
    const legacyPath = dir.replace(/^\/+/, "").replace(/\/+$/, "");
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    posts.push({ dir, legacyPath, title: "", published: "", description: "", bodyHtml: html });
  }
  return posts;
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });

  const posts = discoverPosts();
  if (posts.length === 0) {
    console.error("未发现旧文章目录（需要仓库根目录存在 2022/、2024/ 的 Hexo 静态输出）。");
    process.exit(1);
  }

  const results: PostResult[] = [];
  let failed = 0;

  for (const post of posts) {
    const warnings: string[] = [];
    const images: PostResult["images"] = [];
    const slug = post.legacyPath.split("/").pop()!;
    const date = post.legacyPath.split("/").slice(0, 3).join("-"); // YYYY-MM-DD
    const outName = `${date}-${slug}.md`;
    const outFile = path.join(OUT_DIR, outName);

    try {
      const bodyHtml = extractArticleBody(post.bodyHtml, warnings);
      const title = extractTitle(post.bodyHtml, bodyHtml);
      const publishedRaw = extractPublished(post.bodyHtml);
      const published = publishedRaw ? publishedRaw.slice(0, 10) : date;
      const description = extractDescription(post.bodyHtml, bodyHtml);
      const cleaned = cleanBody(bodyHtml, title);

      if (!title) warnings.push("title could not be extracted");
      if (!publishedRaw) warnings.push("published date not found, using path date");

      const ctx: ConvertContext = { warnings, images };
      const converter = new Converter(cleaned, ctx);
      const md = converter.convert();

      const frontmatter = toFrontmatterYaml({ title, published, description, legacyPath: post.legacyPath });
      fs.writeFileSync(outFile, frontmatter + "\n\n" + md + "\n", "utf8");

      results.push({
        dir: post.dir,
        legacyPath: post.legacyPath,
        title,
        published,
        description,
        outFile: path.relative(ROOT, outFile),
        status: "ok",
        warnings,
        images,
      });
    } catch (err) {
      failed++;
      results.push({
        dir: post.dir,
        legacyPath: post.legacyPath,
        title: "",
        published: date,
        description: "",
        outFile: "",
        status: "failed",
        warnings: [`error: ${(err as Error).message}`],
        images,
      });
    }
  }

  const allImages = results.flatMap((r) => r.images);
  const stats = {
    discovered: posts.length,
    converted: results.filter((r) => r.status === "ok").length,
    failed: failed,
    warnings: results.reduce((n, r) => n + r.warnings.length, 0),
    imagesKept: allImages.filter((i) => i.status === "kept").length,
    imagesMissing: allImages.filter((i) => i.status === "missing").length,
    imagesSkipped: allImages.filter((i) => i.status === "skipped").length,
    legacyUrlsPreserved: results.length,
  };

  fs.writeFileSync(INDEX_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), stats, posts: results }, null, 2), "utf8");

  console.log(`Legacy posts discovered: ${stats.discovered}`);
  console.log(`Posts converted: ${stats.converted}`);
  console.log(`Posts failed: ${stats.failed}`);
  console.log(`Conversion warnings: ${stats.warnings}`);
  console.log(`Images kept: ${stats.imagesKept}, missing: ${stats.imagesMissing}, skipped: ${stats.imagesSkipped}`);
  console.log(`Legacy URLs preserved: ${stats.legacyUrlsPreserved}`);
  console.log(`Output: ${path.relative(ROOT, OUT_DIR)}/`);
  for (const r of results) {
    if (r.warnings.length) {
      console.log(`  [warn] ${r.legacyPath}`);
      for (const w of r.warnings) console.log(`         - ${w}`);
    }
  }
  if (failed > 0) process.exitCode = 1;
}

main();
