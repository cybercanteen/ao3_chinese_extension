// content.js
(function () {
  const DICT = window.AO3_UI_DICT || { exact: {}, contains: [], placeholders: {} };
  const MARK = "data-ao3-zh";
  const BTN_CLASS = "ao3-translate-btn";
  const TL_CLASS = "ao3-cn-translation";
  const NOTES_BTN_CLASS = "ao3-translate-notes-btn";

  function injectStyles() {
    if (document.getElementById("ao3-zh-style")) return;

    const style = document.createElement("style");
    style.id = "ao3-zh-style";
    style.textContent = `
      .${BTN_CLASS},
      .${NOTES_BTN_CLASS} {
        display: inline-block;
        margin: 8px 0 14px;
        padding: 6px 12px;
        border: 1px solid #999;
        border-radius: 6px;
        background: #fff;
        color: #222;
        cursor: pointer;
        font-size: 14px;
        line-height: 1.2;
      }
      .${BTN_CLASS}:hover,
      .${NOTES_BTN_CLASS}:hover {
        background: #f3f3f3;
      }
      .${BTN_CLASS}[disabled],
      .${NOTES_BTN_CLASS}[disabled] {
        opacity: .65;
        cursor: not-allowed;
      }
      .${TL_CLASS} {
        border-left: 3px solid #b9b9b9;
        margin: 8px 0 16px;
        padding: 6px 10px;
        background: #f7f7f7;
        border-radius: 6px;
        line-height: 1.6;
        font-size: 0.96em;
        white-space: pre-wrap;
      }
      .ao3-submit-hint {
        display: inline-block;
        margin-left: 8px;
        color: #666;
        font-size: 14px;
        line-height: 1.2;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function shouldSkipElement(el) {
    if (!el) return true;

    if (
      el.closest("script, style, textarea, pre, code") ||
      el.closest(`.${TL_CLASS}`)
    ) {
      return true;
    }

    // 自动汉化时跳过正文 / 摘要 / 备注正文，改为按钮触发翻译
    if (
      el.closest(".chapter .userstuff.module") ||
      el.closest(".chapter .notes.module blockquote.userstuff") ||
      el.closest(".summary.module .userstuff") ||
      el.closest(".notes.module .userstuff") ||
      el.closest(".end.notes.module blockquote.userstuff") ||
      el.closest("blockquote.userstuff")
    ) {
      return true;
    }

    return false;
  }

  function translateExact(text) {
    const clean = normalizeText(text);
    if (!clean) return text;

    if (DICT.exact[clean]) {
      return text.replace(clean, DICT.exact[clean]);
    }

    // 动态用户名：Hi, username!
    const hiMatch = clean.match(/^Hi,\s*(.+?)!$/);
    if (hiMatch) {
      return text.replace(clean, `${hiMatch[1]}，你好！`);
    }

    // 通用后台计数项：Works (1) -> 作品（1）
    const dashboardCountMatch = clean.match(/^(Works|Drafts|Series|Bookmarks|Collections|Inbox|Sign-ups|Assignments|Claims|Related Works|Gifts)\s*\((\d+)\)$/i);
    if (dashboardCountMatch) {
      const map = {
        "works": "作品",
        "drafts": "草稿",
        "series": "系列",
        "bookmarks": "书签",
        "collections": "合集",
        "inbox": "收件箱",
        "sign-ups": "报名",
        "assignments": "任务分配",
        "claims": "认领",
        "related works": "相关作品",
        "gifts": "赠礼"
      };
      const key = dashboardCountMatch[1].toLowerCase();
      if (map[key]) {
        return text.replace(clean, `${map[key]}（${dashboardCountMatch[2]}）`);
      }
    }

    // Comments (2)
    const commentsMatch = clean.match(/^Comments\s*\((\d+)\)$/i);
    if (commentsMatch) {
      return text.replace(clean, `评论（${commentsMatch[1]}）`);
    }

    // Hide Comments (4)
    const hideCommentsMatch = clean.match(/^Hide Comments\s*\((\d+)\)$/i);
    if (hideCommentsMatch) {
      return text.replace(clean, `隐藏评论（${hideCommentsMatch[1]}）`);
    }

    // Hide Comments
    if (/^Hide Comments$/i.test(clean)) {
      return text.replace(clean, "隐藏评论");
    }

    // Show Comments
    const showCommentsMatch = clean.match(/^Show Comments\s*\((\d+)\)$/i);
    if (showCommentsMatch) {
      return text.replace(clean, `显示评论（${showCommentsMatch[1]}）`);
    }
    if (/^Show Comments$/i.test(clean)) {
      return text.replace(clean, "显示评论");
    }

    // Previous / Next Chapter with arrows
    if (/^←\s*Previous Chapter$/i.test(clean)) {
      return text.replace(clean, "← 上一章");
    }
    if (/^Next Chapter\s*→$/i.test(clean)) {
      return text.replace(clean, "下一章 →");
    }
    if (/^Previous Chapter$/i.test(clean)) {
      return text.replace(clean, "上一章");
    }
    if (/^Next Chapter$/i.test(clean)) {
      return text.replace(clean, "下一章");
    }

    // Part X of ...
    const partMatch = clean.match(/^Part\s+(\d+)\s+of\s+(.+)$/i);
    if (partMatch) {
      return text.replace(clean, `第 ${partMatch[1]} 部分，属于 ${partMatch[2]}`);
    }

    // 255 characters left
    const charsLeftMatch = clean.match(/^(\d+)\s+characters left$/i);
    if (charsLeftMatch) {
      return text.replace(clean, `${charsLeftMatch[1]} 字剩余`);
    }

    // 单独出现的 of
    if (/^of$/i.test(clean)) {
      return text.replace(clean, "共");
    }

    // Save Draft
    if (/^Save Draft$/i.test(clean)) {
      return text.replace(clean, "保存草稿");
    }

    // Post New Chapter
    if (/^Post New Chapter$/i.test(clean)) {
      return text.replace(clean, "发布新章节");
    }

    // Type or paste formatted text.
    if (/^Type or paste formatted text\.$/i.test(clean)) {
      return text.replace(clean, "输入或粘贴已格式化文本。");
    }

    // All works you post on AO3 must comply with our
    if (/^All works you post on AO3 must comply with our$/i.test(clean)) {
      return text.replace(clean, "你在 AO3 发布的所有作品都必须遵守我们的");
    }

    // For more information, please refer to our
    if (/^For more information, please refer to our$/i.test(clean)) {
      return text.replace(clean, "更多信息请参阅我们的");
    }

    // Post Chapter
    if (/^Post Chapter$/i.test(clean)) {
      return text.replace(clean, "发布章节");
    }

    // Please wait...
    if (/^Please wait\.\.\.$/i.test(clean)) {
      return text.replace(clean, "请稍候...");
    }

    // Warning text in notes
    if (/^Warning: Unchecking this box will delete the existing beginning note\.$/i.test(clean)) {
      return text.replace(clean, "警告：取消勾选后，将删除现有的开头备注。");
    }

    if (/^Warning: Unchecking this box will delete the existing end note\.$/i.test(clean)) {
      return text.replace(clean, "警告：取消勾选后，将删除现有的结尾备注。");
    }

    // works/search
    if (/^Search Works$/i.test(clean)) {
      return text.replace(clean, "作品搜索");
    }
    if (/^People Search$/i.test(clean)) {
      return text.replace(clean, "用户搜索");
    }
    if (/^Bookmark Search$/i.test(clean)) {
      return text.replace(clean, "书签搜索");
    }
    if (/^Tag Search$/i.test(clean)) {
      return text.replace(clean, "标签搜索");
    }
    if (/^Work Info$/i.test(clean)) {
      return text.replace(clean, "作品信息");
    }
    if (/^Any Field$/i.test(clean)) {
      return text.replace(clean, "任意字段");
    }
    if (/^Completion status$/i.test(clean)) {
      return text.replace(clean, "完结状态");
    }
    if (/^All works$/i.test(clean)) {
      return text.replace(clean, "所有作品");
    }
    if (/^Complete works only$/i.test(clean)) {
      return text.replace(clean, "仅已完结作品");
    }
    if (/^Works in progress only$/i.test(clean)) {
      return text.replace(clean, "仅连载中作品");
    }
    if (/^Crossovers$/i.test(clean)) {
      return text.replace(clean, "跨作品");
    }
    if (/^Include crossovers$/i.test(clean)) {
      return text.replace(clean, "包含跨作品");
    }
    if (/^Exclude crossovers$/i.test(clean)) {
      return text.replace(clean, "排除跨作品");
    }
    if (/^Only crossovers$/i.test(clean)) {
      return text.replace(clean, "仅跨作品");
    }
    if (/^Single Chapter$/i.test(clean)) {
      return text.replace(clean, "单章节");
    }
    if (/^Word Count$/i.test(clean)) {
      return text.replace(clean, "字数");
    }
    if (/^Language$/i.test(clean)) {
      return text.replace(clean, "语言");
    }
    if (/^Work Tags$/i.test(clean)) {
      return text.replace(clean, "作品标签");
    }
    if (/^Rating$/i.test(clean)) {
      return text.replace(clean, "分级");
    }
    if (/^Warnings$/i.test(clean)) {
      return text.replace(clean, "警告");
    }
    if (/^Category$/i.test(clean)) {
      return text.replace(clean, "作品类型");
    }
    if (/^Fandoms$/i.test(clean)) {
      return text.replace(clean, "原作");
    }
    if (/^Relationships$/i.test(clean)) {
      return text.replace(clean, "关系");
    }
    if (/^Characters$/i.test(clean)) {
      return text.replace(clean, "角色");
    }
    if (/^Additional Tags$/i.test(clean)) {
      return text.replace(clean, "附加标签");
    }
    if (/^Search within results$/i.test(clean)) {
      return text.replace(clean, "在结果中搜索");
    }
    if (/^Sort by$/i.test(clean)) {
      return text.replace(clean, "排序方式");
    }
    if (/^Gen$/i.test(clean)) {
      return text.replace(clean, "Gen（无CP）");
    }
    if (/^F\/M$/i.test(clean)) {
      return text.replace(clean, "F/M（男女）");
    }
    if (/^M\/M$/i.test(clean)) {
      return text.replace(clean, "M/M（男男）");
    }
    if (/^F\/F$/i.test(clean)) {
      return text.replace(clean, "F/F（女女）");
    }
    if (/^Multi$/i.test(clean)) {
      return text.replace(clean, "Multi（多配对）");
    }
    if (/^Other$/i.test(clean)) {
      return text.replace(clean, "Other（其他）");
    }

    // subscriptions
    if (/^Subscriptions$/i.test(clean)) {
      return text.replace(clean, "订阅更新");
    }
    if (/^Author Subscriptions$/i.test(clean)) {
      return text.replace(clean, "作者更新");
    }
    if (/^Work Subscriptions$/i.test(clean)) {
      return text.replace(clean, "作品更新");
    }
    if (/^Series Subscriptions$/i.test(clean)) {
      return text.replace(clean, "系列更新");
    }
    if (/^Subscribe$/i.test(clean)) {
      return text.replace(clean, "订阅更新");
    }
    if (/^Unsubscribe$/i.test(clean)) {
      return text.replace(clean, "取消订阅");
    }

    const unsubFromMatch = clean.match(/^Unsubscribe from\s+(.+)$/i);
    if (unsubFromMatch) {
      return text.replace(clean, `取消对 ${unsubFromMatch[1]} 的订阅`);
    }

    const subToMatch = clean.match(/^Subscribe to\s+(.+)$/i);
    if (subToMatch) {
      return text.replace(clean, `订阅 ${subToMatch[1]} 的更新`);
    }

    const flashTranslated = translateFlashTemplate(clean);
    if (flashTranslated !== clean) {
      return text.replace(clean, flashTranslated);
    }

    return text;
  }

  function translateContains(text) {
    let out = text;
    for (const [src, dst] of DICT.contains || []) {
      if (out.includes(src)) {
        out = out.split(src).join(dst);
      }
    }
    out = out.replace(/（(\d+)\)/g, "（$1）");
    return out;
  }

  function translateTextValue(text) {
    let out = translateExact(text);
    out = translateContains(out);
    return out;
  }

  function translateFlashTemplate(text) {
    if (!text) return text;

    const rules = [
      [/^You have successfully unsubscribed from (.+)\.$/i, "你已成功取消订阅 $1。"],
      [/^You are now subscribed to (.+)\.$/i, "你已成功订阅 $1。"],
      [/^You are already subscribed to (.+)\.$/i, "你已经订阅了 $1。"],
      [/^Subscription saved\.$/i, "订阅已保存。"],

      [/^Your comment has been posted\.$/i, "评论已发布。"],
      [/^Your comment has been deleted\.$/i, "评论已删除。"],
      [/^Your comment has been edited\.$/i, "评论已更新。"],
      [/^Comments are closed for this work\.$/i, "此作品已关闭评论。"],

      [/^Bookmark created\.$/i, "书签已创建。"],
      [/^Bookmark updated\.$/i, "书签已更新。"],
      [/^Bookmark deleted\.$/i, "书签已删除。"],

      [/^Work posted successfully\.$/i, "作品已发布。"],
      [/^Work updated successfully\.$/i, "作品已更新。"],
      [/^Work deleted\.$/i, "作品已删除。"],
      [/^Draft saved\.$/i, "草稿已保存。"],

      [/^Chapter posted successfully\.$/i, "章节已发布。"],
      [/^Chapter updated successfully\.$/i, "章节已更新。"],
      [/^Chapter deleted\.$/i, "章节已删除。"],

      [/^Work added to collection\.$/i, "作品已加入合集。"],
      [/^Work removed from collection\.$/i, "作品已从合集移除。"],

      [/^Your changes have been saved\.$/i, "更改已保存。"],
      [/^Preferences updated\.$/i, "偏好设置已更新。"],

      [/^Successfully logged in\.$/i, "登录成功。"],
      [/^Successfully logged out\.$/i, "已退出登录。"],
      [/^Account created successfully\.$/i, "账号创建成功。"],

      [/^You are not authorized to do that\.$/i, "你没有权限执行此操作。"],
      [/^Something went wrong\.$/i, "出现错误。"],
      [/^Please try again\.$/i, "请重试。"]
    ];

    for (const [regex, replacement] of rules) {
      if (regex.test(text)) return text.replace(regex, replacement);
    }

    return text;
  }

  function isSubmitInput(el) {
    return el instanceof HTMLInputElement &&
      (el.getAttribute("type") || "").toLowerCase() === "submit";
  }

  function upsertSubmitHint(el) {
    if (!isSubmitInput(el)) return;
    if (el.offsetParent === null) return;

    const value = el.getAttribute("value") || "";
    if (!value) return;

    const translated = translateTextValue(value);
    if (!translated || translated === value) return;

    let hint = el.nextElementSibling;
    if (!hint || !hint.classList.contains("ao3-submit-hint")) {
      hint = document.createElement("span");
      hint.className = "ao3-submit-hint";
      el.insertAdjacentElement("afterend", hint);
    }
    hint.textContent = `（${translated}）`;
  }

  function translateFlashMessages(root = document.body) {
    const flashes = root.querySelectorAll(".flash, .flash.notice, .flash.success, .flash.alert, .flash.error");

    flashes.forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const text = normalizeText(el.textContent || "");
      if (!text) return;

      const translated = translateFlashTemplate(text);
      if (translated !== text) {
        el.textContent = translated;
      }

      el.setAttribute(MARK, "1");
    });
  }

  function translateTextNodes(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;

    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.hasAttribute(MARK)) continue;
      if (shouldSkipElement(parent)) continue;

      const original = node.nodeValue;
      const clean = normalizeText(original);
      if (!clean) continue;

      const translated = translateTextValue(original);

      if (translated !== original) {
        node.nodeValue = translated;
        parent.setAttribute(MARK, "1");
      }
    }
  }

  function translateInputs(root = document.body) {
    const fields = root.querySelectorAll("input, textarea, select, option, button, label, legend, h1, h2, h3, h4, h5, h6, a, span, dt, dd, p");
    fields.forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const name = el.getAttribute("name");
        const placeholder = el.getAttribute("placeholder");

        if (name && DICT.placeholders && DICT.placeholders[name]) {
          el.setAttribute("placeholder", DICT.placeholders[name]);
          el.setAttribute(MARK, "1");
        } else if (placeholder) {
          const translatedPlaceholder = translateTextValue(placeholder);
          if (translatedPlaceholder !== placeholder) {
            el.setAttribute("placeholder", translatedPlaceholder);
            el.setAttribute(MARK, "1");
          }
        }

        upsertSubmitHint(el);
      }

      if (el instanceof HTMLButtonElement) {
        const text = el.textContent || "";
        const translatedText = translateTextValue(text);
        if (translatedText !== text) {
          el.textContent = translatedText.trim();
          el.setAttribute(MARK, "1");
        }
      }

      if (el.tagName === "A") {
        const text = el.textContent || "";
        const translatedText = translateTextValue(text);
        if (translatedText !== text) {
          el.textContent = translatedText.trim();
          el.setAttribute(MARK, "1");
        }
      }

      ["aria-label", "title"].forEach(attr => {
        const v = el.getAttribute(attr);
        if (!v) return;
        const translated = translateTextValue(v);
        if (translated !== v) {
          el.setAttribute(attr, translated);
          el.setAttribute(MARK, "1");
        }
      });
    });
  }

  function translateMetaSection() {
    const meta = document.querySelector("dl.work.meta.group");
    if (!meta) return;

    meta.querySelectorAll("dt").forEach(dt => {
      if (dt.hasAttribute(MARK)) return;
      const original = dt.textContent || "";
      const translated = translateTextValue(original);
      if (translated !== original) {
        dt.textContent = translated.trim();
      }
      dt.setAttribute(MARK, "1");
    });

    meta.querySelectorAll("dd").forEach(dd => {
      if (dd.hasAttribute(MARK)) return;

      const klass = dd.className || "";
      const text = normalizeText(dd.textContent || "");

      const safeClasses = ["rating", "warning", "category", "language"];

      if (safeClasses.some(c => klass.includes(c))) {
        dd.querySelectorAll("*").forEach(child => {
          if (child.children.length === 0) {
            const t = child.textContent || "";
            const tr = translateTextValue(t);
            if (tr !== t) child.textContent = tr;
          }
        });

        const translated = translateTextValue(text);
        if (translated !== text && dd.children.length === 0) {
          dd.textContent = translated;
        }
        dd.setAttribute(MARK, "1");
      }

      if (klass.includes("stats")) {
        dd.querySelectorAll("dt, dd").forEach(x => {
          if (x.hasAttribute(MARK)) return;
          const t = x.textContent || "";
          const tr = translateTextValue(t);
          if (tr !== t) {
            x.textContent = tr.trim();
          }
          x.setAttribute(MARK, "1");
        });
      }
    });
  }

  function translateWorksNew() {
    const path = location.pathname || "";
    const isWorkNew = /^\/works\/new(?:\/)?$/.test(path);
    const isChapterNew = /^\/works\/\d+\/chapters\/new(?:\/)?$/.test(path);

    if (!isWorkNew && !isChapterNew) return;

    document.querySelectorAll(
      "#main h1, #main h2, #main h3, #main h4, #main legend, #main legend.required, #main label, #main dt, #main dd, #main p.note, #main p.notice, #main p.required.notice, #main .notice, #main span"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const original = el.textContent || "";
      const translated = translateTextValue(original);
      if (translated !== original) {
        el.textContent = translated.trim();
      }
      el.setAttribute(MARK, "1");
    });

    document.querySelectorAll(
      "#main input, #main textarea, #main button, #main option, #main a, #main select"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const placeholder = el.getAttribute("placeholder");
      const title = el.getAttribute("title");
      const aria = el.getAttribute("aria-label");
      const text = el.textContent || "";

      upsertSubmitHint(el);

      if (placeholder) {
        const translatedPlaceholder = translateTextValue(placeholder);
        if (translatedPlaceholder !== placeholder) {
          el.setAttribute("placeholder", translatedPlaceholder);
        }
      }

      if (title) {
        const translatedTitle = translateTextValue(title);
        if (translatedTitle !== title) {
          el.setAttribute("title", translatedTitle);
        }
      }

      if (aria) {
        const translatedAria = translateTextValue(aria);
        if (translatedAria !== aria) {
          el.setAttribute("aria-label", translatedAria);
        }
      }

      if (
        el.tagName === "A" ||
        el.tagName === "BUTTON" ||
        el.tagName === "OPTION" ||
        el.tagName === "SPAN"
      ) {
        const translatedText = translateTextValue(text);
        if (translatedText !== text) {
          el.textContent = translatedText.trim();
        }
      }

      el.setAttribute(MARK, "1");
    });

    document.querySelectorAll("#main .rtf-notes").forEach(el => {
      const html = el.innerHTML;
      const replaced = html.replace("Type or paste formatted text.", "输入或粘贴已格式化文本。");
      if (replaced !== html) {
        el.innerHTML = replaced;
      }
    });

    document.querySelectorAll("#main p.notice").forEach(el => {
      const html = el.innerHTML;
      let replaced = html;

      replaced = replaced.replace(
        "All works you post on AO3 must comply with our",
        "你在 AO3 发布的所有作品都必须遵守我们的"
      );
      replaced = replaced.replace(
        "For more information, please refer to our",
        "更多信息请参阅我们的"
      );

      if (replaced !== html) {
        el.innerHTML = replaced;
      }
    });
  }

  function translateWorksSearch() {
    const path = location.pathname || "";
    if (!/^\/works\/search(?:\/)?$/.test(path)) return;

    document.querySelectorAll(
      "#main h1, #main h2, #main h3, #main h4, #main legend, #main dt, #main dd, #main label, #main span, #main option, #main button, #main a, #main p"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const text = el.textContent || "";
      const translated = translateTextValue(text);
      if (translated !== text) {
        el.textContent = translated.trim();
      }
      el.setAttribute(MARK, "1");
    });

    document.querySelectorAll("#main input, #main textarea, #main select, #main a").forEach(el => {
      if (shouldSkipElement(el)) return;

      const placeholder = el.getAttribute("placeholder");
      const title = el.getAttribute("title");
      const aria = el.getAttribute("aria-label");

      upsertSubmitHint(el);

      if (placeholder) {
        const translatedPlaceholder = translateTextValue(placeholder);
        if (translatedPlaceholder !== placeholder) {
          el.setAttribute("placeholder", translatedPlaceholder);
        }
      }

      if (title) {
        const translatedTitle = translateTextValue(title);
        if (translatedTitle !== title) {
          el.setAttribute("title", translatedTitle);
        }
      }

      if (aria) {
        const translatedAria = translateTextValue(aria);
        if (translatedAria !== aria) {
          el.setAttribute("aria-label", translatedAria);
        }
      }
    });
  }

  function translateSubscriptionsPage() {
    const path = location.pathname || "";
    if (!/^\/users\/[^/]+\/subscriptions(?:\/)?$/.test(path)) return;

    const roots = document.querySelectorAll("#dashboard, #main, #main .subscriptions, #main .listbox");
    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll("h1, h2, h3, h4, a, button, label, legend, p, span, th, td, li, dt, dd, input").forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (shouldSkipElement(el)) return;

        const text = el.textContent || "";
        const translated = translateTextValue(text);

        upsertSubmitHint(el);

        if (translated !== text && !el.matches("input")) {
          el.textContent = translated.trim();
        }

        const title = el.getAttribute("title");

        upsertSubmitHint(el);

        if (title) {
          const translatedTitle = translateTextValue(title);
          if (translatedTitle !== title) {
            el.setAttribute("title", translatedTitle);
          }
        }

        const aria = el.getAttribute("aria-label");

        upsertSubmitHint(el);

        if (aria) {
          const translatedAria = translateTextValue(aria);
          if (translatedAria !== aria) {
            el.setAttribute("aria-label", translatedAria);
          }
        }

        el.setAttribute(MARK, "1");
      });
    });
  }

  function translateCommentUI() {
    const roots = document.querySelectorAll(
      "#feedback, #comments, .comments, .comment, .thread, form[action*='/comments']"
    );
    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll("h3, h4, h5, a, button, label, legend, input, textarea, p, span, li").forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (el.closest(`.${TL_CLASS}`)) return;

        const text = el.textContent || "";
        const placeholder = el.getAttribute("placeholder");
        const title = el.getAttribute("title");
        const aria = el.getAttribute("aria-label");

        if (!el.matches("input, textarea")) {
          const translatedText = translateTextValue(text);
          if (translatedText !== text) {
            el.textContent = translatedText.trim();
          }
        }

        if (placeholder) {
          const translatedPlaceholder = translateTextValue(placeholder);
          if (translatedPlaceholder !== placeholder) {
            el.setAttribute("placeholder", translatedPlaceholder);
          }
        } else if (el instanceof HTMLTextAreaElement) {
          const name = el.getAttribute("name") || "";
          if (name.includes("comment")) {
            el.setAttribute("placeholder", "输入评论内容");
          }
        }

        if (title) {
          const translatedTitle = translateTextValue(title);
          if (translatedTitle !== title) {
            el.setAttribute("title", translatedTitle);
          }
        }

        if (aria) {
          const translatedAria = translateTextValue(aria);
          if (translatedAria !== aria) {
            el.setAttribute("aria-label", translatedAria);
          }
        }

        el.setAttribute(MARK, "1");
      });
    });
  }

  function forceTranslateCommentActionLinks() {
    document.querySelectorAll("#feedback a, #comments a, .comment a, .thread a, #feedback button, #comments button, .comment button, .thread button").forEach(el => {
      const text = (el.textContent || "").trim();
      if (!text) return;

      const translated = translateTextValue(text);
      if (translated !== text) {
        el.textContent = translated;
        el.setAttribute(MARK, "1");
      }
    });
  }

  function translateDashboardUI() {
    if (!/^\/users\/[^/]+(?:\/.*)?$/.test(location.pathname)) return;

    const roots = document.querySelectorAll("#dashboard, #main.users-show.dashboard, #main.users-show, #main");
    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll("h1, h2, h3, h4, a, button, label, legend, p, span, th, td, input").forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (shouldSkipElement(el)) return;

        const text = el.textContent || "";
        const translated = translateTextValue(text);

        upsertSubmitHint(el);

        if (translated !== text && !el.matches("input")) {
          el.textContent = translated.trim();
        }

        const title = el.getAttribute("title");
        if (title) {
          const translatedTitle = translateTextValue(title);
          if (translatedTitle !== title) {
            el.setAttribute("title", translatedTitle);
          }
        }

        el.setAttribute(MARK, "1");
      });
    });
  }

  function translateFirstLoginBanner() {
    const banner = document.querySelector("#first-login-help-banner");
    if (!banner) return;

    banner.querySelectorAll("p, a, button, input, span").forEach(el => {
      if (el.hasAttribute(MARK)) return;

      const text = el.textContent || "";
      const translated = translateTextValue(text);

      if (translated !== text && !el.matches("input")) {
        el.textContent = translated.trim();
      }

      const title = el.getAttribute("title");
      if (title) {
        const translatedTitle = translateTextValue(title);
        if (translatedTitle !== title) {
          el.setAttribute("title", translatedTitle);
        }
      }

      el.setAttribute(MARK, "1");
    });

    banner.innerHTML = banner.innerHTML
      .replace(/Hi! It looks like you've just logged in to AO3 for the first time\./g, "你好！看起来这是你第一次登录 AO3。")
      .replace(/For help getting started on AO3, check out some/g, "如果你想快速上手 AO3，可以查看一些")
      .replace(/or browse through/g, "或浏览")
      .replace(/If you need technical support,/g, "如果你需要技术支持，")
      .replace(/If you experience harassment or have questions about our/g, "如果你遭遇骚扰，或对我们的")
      .replace(/\(including the/g, "（包括")
      .replace(/\),/g, "），")
      .replace(/and/g, "以及");
  }

  function translateDeleteCommentModal() {
    const modals = document.querySelectorAll(
      "[id^='delete_comment_placeholder_'], .delete-comment-placeholder"
    );
    if (!modals.length) return;

    modals.forEach(modal => {
      modal.querySelectorAll("h3, h4, p, a, button, input, span, li").forEach(el => {
        if (el.hasAttribute(MARK)) return;

        const text = el.textContent || "";
        const translated = translateTextValue(text);

        if (translated !== text && !el.matches("input")) {
          el.textContent = translated.trim();
        }

        const title = el.getAttribute("title");
        if (title) {
          const translatedTitle = translateTextValue(title);
          if (translatedTitle !== title) {
            el.setAttribute("title", translatedTitle);
          }
        }

        el.setAttribute(MARK, "1");
      });

      modal.innerHTML = modal.innerHTML.replace(
        /Are you sure you want to delete this comment\?/g,
        "你确定要删除这条评论吗？"
      );
    });
  }

  function sendTranslateRequest(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "AO3_TRANSLATE_TEXT",
          payload: {
            text,
            sourceLang: "auto",
            targetLang: "zh-CN"
          }
        },
        (resp) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          if (!resp?.ok) return reject(new Error(resp?.error || "Translate failed"));
          resolve(resp.data || "");
        }
      );
    });
  }

  async function translateParagraphGroup(paragraphs) {
    for (const p of paragraphs) {
      if (p.nextElementSibling && p.nextElementSibling.classList.contains(TL_CLASS)) {
        continue;
      }

      const text = normalizeText(p.innerText || p.textContent || "");
      if (!text || text === "&nbsp;") continue;

      const box = document.createElement("div");
      box.className = TL_CLASS;
      box.textContent = "翻译中…";
      p.insertAdjacentElement("afterend", box);

      try {
        const translated = await sendTranslateRequest(text);
        box.textContent = translated || "(无翻译结果)";
      } catch (e) {
        box.textContent = `(翻译失败：${String(e.message || e)})`;
      }
    }
  }

  async function translateChapter(section, button) {
    if (!section) return;
    const paragraphs = [...section.querySelectorAll("p")];

    button.disabled = true;
    button.textContent = "翻译中…";

    await translateParagraphGroup(paragraphs);

    button.textContent = "已翻译本章";
  }

  async function translateNotes(section, button) {
    if (!section) return;
    const paragraphs = [...section.querySelectorAll("blockquote.userstuff p")];
    if (!paragraphs.length) return;

    button.disabled = true;
    button.textContent = "翻译中…";

    await translateParagraphGroup(paragraphs);

    button.textContent = "已翻译备注";
  }

  function insertTranslateButtons() {
    // 正文章节按钮
    const sections = document.querySelectorAll(
      ".chapter .userstuff.module[role='article'], #chapters > .userstuff"
    );

    sections.forEach(section => {
      const heading =
        section.querySelector("h3#work, h3.landmark.heading") ||
        document.querySelector("#chapters > h3#work, #chapters > h3.landmark.heading");

      if (!heading) return;

      // 按钮插在 heading 后面，不一定在 section 里面，所以改成检查 heading 邻接节点
      if (heading.nextElementSibling && heading.nextElementSibling.classList.contains(BTN_CLASS)) {
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.textContent = "翻译本章";

      btn.addEventListener("click", () => translateChapter(section, btn));
      heading.insertAdjacentElement("afterend", btn);
    });

    // 章节前备注按钮 / 一般备注按钮
    const noteModules = document.querySelectorAll(".chapter .notes.module, .notes.module");
    noteModules.forEach(section => {
      if (section.querySelector(`.${NOTES_BTN_CLASS}`)) return;

      const heading = section.querySelector("h3.heading");
      const quote = section.querySelector("blockquote.userstuff");
      if (!heading || !quote) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = NOTES_BTN_CLASS;
      btn.textContent = "翻译备注";

      btn.addEventListener("click", () => translateNotes(section, btn));
      heading.insertAdjacentElement("afterend", btn);
    });

    // 作品结尾备注按钮
    const endNotes = document.querySelectorAll("#work_endnotes.end.notes.module");
    endNotes.forEach(section => {
      if (section.querySelector(`.${NOTES_BTN_CLASS}`)) return;

      const heading = section.querySelector("h3.heading");
      const quote = section.querySelector("blockquote.userstuff");
      if (!heading || !quote) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = NOTES_BTN_CLASS;
      btn.textContent = "翻译备注";

      btn.addEventListener("click", () => translateNotes(section, btn));
      heading.insertAdjacentElement("afterend", btn);
    });
  }

  function runAll() {
    injectStyles();
    translateFlashMessages(document.body);
    translateTextNodes(document.body);
    translateInputs(document.body);
    translateMetaSection();
    translateWorksNew();
    translateWorksSearch();
    translateSubscriptionsPage();
    translateCommentUI();
    forceTranslateCommentActionLinks();
    translateDashboardUI();
    translateFirstLoginBanner();
    translateDeleteCommentModal();
    insertTranslateButtons();
  }

  function setupObserver() {
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        runAll();
      }, 180);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  runAll();
  setupObserver();
})();