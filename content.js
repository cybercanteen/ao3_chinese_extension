// content.js
(function () {
  const DICT = window.AO3_UI_DICT || { exact: {}, contains: [], placeholders: {} };
  const MARK = "data-ao3-zh";
  const BTN_CLASS = "ao3-translate-btn";
  const TL_CLASS = "ao3-cn-translation";
  const NOTES_BTN_CLASS = "ao3-translate-notes-btn";

  const CONTROL_HINTS = {
    Subscribe: "订阅更新",
    Unsubscribe: "取消订阅",
    "Dismiss permanently": "永久关闭",
    Invite: "邀请",
    "Post New": "发布新作品",
    "Post New Work": "发布新作品",
    "Edit Works": "编辑作品",
    "I agree/consent to these Terms": "我同意这些条款",
  };

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

      .ao3-zh-native-file-input {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }

      .ao3-zh-file-control {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .ao3-google-translate-controls {
        margin: 10px 0 20px;
      }

     .ao3-google-translate-note {
        margin: 4px 0 0;
        font-size: 0.9em;
        color: #666;
      }

      .ao3-google-policy-translation {
        border-left: 3px solid #b9b9b9;
       margin: 6px 0 14px;
        padding: 6px 10px;
        background: #f7f7f7;
        border-radius: 6px;
        line-height: 1.6;
      }
      .ao3-zh-file-control button {
        margin: 0;
      }

      .ao3-zh-file-name {
        display: inline-block;
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  // 用户生成的内容（作品标题、作者名、系列名、自由 tag 等）
  // 不能被 UI 字典改写，否则 tag「more than friends」会变成「超过 friends」。
  // 注意：选择器必须只匹配「展示用户内容」的位置，不能匹配发布/编辑表单。
  // 表单里 dt/dd 也带 .byline、.title 类（Creator/Pseud(s)、Work Title*），
  // 所以这里限定到标题 h2/h3 和 .heading.byline。
  const USER_CONTENT_SELECTOR = [
    "a[rel='author']",
    ".heading.byline",
    ".preface h2.title",
    ".preface h3.title",
    ".blurb .heading a",
    "dd.series a[href^='/series/']",
    "dd.collections a[href^='/collections/']",
    // 发布表单里的笔名下拉项是用户自己的笔名，不能被字典改写
    "select[name*='author_attributes'] option"
  ].join(", ");

  // 这些区域里的 tag 是 AO3 固定枚举值（分级/警告/分类/语言），需要继续翻译。
  const FIXED_TAG_AREA =
    "dd.rating, dd.warning, dd.category, dd.language, " +
    "li.warnings, .required-tags";

  function isUserGeneratedContent(el) {
    if (el.closest(USER_CONTENT_SELECTOR)) return true;

    const tag = el.closest("a.tag");

    return Boolean(
      tag && !tag.closest(FIXED_TAG_AREA)
    );
  }

  function shouldSkipElement(el) {
  if (!el) return true;

  if (isUserGeneratedContent(el)) return true;

  if (
    el.closest("script, style, textarea, pre, code") ||
    el.closest(`.${TL_CLASS}`)
  ) {
    return true;
  }

  // 自动汉化时跳过正文、摘要和备注正文，改为按钮触发翻译。
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

  // TOS / Content Policy / Privacy Policy 属于政策文本。
  // 不使用 UI 字典自动改写正文，保持 AO3 英文原文完整。
  // 中文由用户主动点击 Google 翻译按钮后另行显示。
  const isPolicyPage =
    /^\/(?:tos|content|privacy)\/?$/.test(
      location.pathname
    );

  if (
    isPolicyPage &&
    el.closest("#main")
  ) {
    return true;
  }

  return false;
}

  // 安全替换元素文字：
  // 没有子元素时直接修改 textContent；
  // 有子元素时只替换第一个非空的直接文本节点。
  // 只含这些「纯视觉格式」标签的元素，才可以整体替换为译文（会丢失加粗等格式）。
  // 刻意不含 SPAN（常带 class/data-/aria- 或是脚本更新的目标，如计数器）
  // 和 BR（整体替换会丢掉换行结构）。拿不准时宁可保持英文，也不破坏 DOM。
  const INLINE_FORMAT_TAGS = new Set([
    "STRONG", "B", "EM", "I", "U", "SMALL", "SUB", "SUP"
  ]);

  function safeSetText(el, newText) {
    if (!el) return;

    if (el.children.length === 0) {
      el.textContent = newText;
      return;
    }

    // 有子元素时，newText 是整个 textContent 的译文，
    // 不能整段塞进第一个文本节点（会造成文字重复/错乱）。
    // 先尝试逐个直接文本节点翻译。
    let changed = false;

    for (const node of el.childNodes) {
      if (
        node.nodeType === Node.TEXT_NODE &&
        node.nodeValue.trim()
      ) {
        const translated =
          translateTextValue(node.nodeValue);

        if (translated !== node.nodeValue) {
          node.nodeValue = translated;
          changed = true;
        }
      }
    }

    if (changed) return;

    // 逐节点一个都没匹配上：说明词条是一整句话，被 <strong> 等拆成了多个文本节点
    // （如 "Note: ... <strong>not</strong> automatically saved"）。
    // 子元素都只是行内格式时，直接用整句译文替换；
    // 含链接/输入框等其它元素时保持原样，避免破坏功能。
    const onlyFormatting = [
      ...el.querySelectorAll("*")
    ].every(n => INLINE_FORMAT_TAGS.has(n.tagName));

    if (onlyFormatting && newText && newText.trim()) {
      el.textContent = newText;
    }
  }

  // 用函数形式替换，避免译文里的 $&、$$ 被当成替换模式；
  // 原文含多余空白导致 clean 找不到时，整体替换并保留首尾空白。
  function replaceOnce(text, clean, out) {
    if (text.includes(clean)) {
      return text.replace(clean, () => out);
    }

    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];

    return lead + out + trail;
  }

  function translateExact(text) {
    const clean = normalizeText(text);

    if (!clean) return text;

    if (Object.prototype.hasOwnProperty.call(DICT.exact, clean)) {
      return replaceOnce(text, 
        clean,
        DICT.exact[clean]
      );
    }

    // Hi, username!
    const hiMatch =
      clean.match(/^Hi,\s*(.+?)!$/);

    if (hiMatch) {
      return replaceOnce(text, 
        clean,
        `${hiMatch[1]}，你好！`
      );
    }

    // Block username
    const blockUserHeadingMatch =
      clean.match(/^Block\s+(.+)$/i);

    if (
      blockUserHeadingMatch &&
      !/^a user$/i.test(
        blockUserHeadingMatch[1]
      )
    ) {
      return replaceOnce(text, 
        clean,
        `屏蔽 ${blockUserHeadingMatch[1]}`
      );
    }

    // Works (1) → 作品（1）
    const dashboardCountMatch = clean.match(
      /^(Works|Drafts|Series|Bookmarks|Collections|Inbox|Sign-ups|Assignments|Claims|Related Works|Gifts)\s*\((\d+)\)$/i
    );

    if (dashboardCountMatch) {
      const map = {
        works: "作品",
        drafts: "草稿",
        series: "系列",
        bookmarks: "书签",
        collections: "合集",
        inbox: "收件箱",
        "sign-ups": "报名",
        assignments: "任务分配",
        claims: "认领",
        "related works": "相关作品",
        gifts: "赠礼",
      };

      const key =
        dashboardCountMatch[1].toLowerCase();

      if (map[key]) {
        return replaceOnce(text, 
          clean,
          `${map[key]}（${dashboardCountMatch[2]}）`
        );
      }
    }

    const commentsMatch =
      clean.match(/^Comments\s*\((\d+)\)$/i);

    if (commentsMatch) {
      return replaceOnce(text, 
        clean,
        `评论（${commentsMatch[1]}）`
      );
    }

    const hideCommentsMatch =
      clean.match(/^Hide Comments\s*\((\d+)\)$/i);

    if (hideCommentsMatch) {
      return replaceOnce(text, 
        clean,
        `隐藏评论（${hideCommentsMatch[1]}）`
      );
    }

    if (/^Hide Comments$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "隐藏评论"
      );
    }

    const showCommentsMatch =
      clean.match(/^Show Comments\s*\((\d+)\)$/i);

    if (showCommentsMatch) {
      return replaceOnce(text, 
        clean,
        `显示评论（${showCommentsMatch[1]}）`
      );
    }

    if (/^Show Comments$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "显示评论"
      );
    }

    if (/^←\s*Previous Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "← 上一章"
      );
    }

    if (/^Next Chapter\s*→$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "下一章 →"
      );
    }

    if (/^Previous Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "上一章"
      );
    }

    if (/^Next Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "下一章"
      );
    }

    const partMatch =
      clean.match(/^Part\s+(\d+)\s+of\s+(.+)$/i);

    if (partMatch) {
      return replaceOnce(text, 
        clean,
        `第 ${partMatch[1]} 部分，属于 ${partMatch[2]}`
      );
    }

    const charsLeftMatch =
      clean.match(/^(\d+)\s+characters left$/i);

    if (charsLeftMatch) {
      return replaceOnce(text, 
        clean,
        `${charsLeftMatch[1]} 字剩余`
      );
    }

    if (/^of$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "共"
      );
    }

    if (/^Save Draft$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "保存草稿"
      );
    }

    if (/^Post New Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "发布新章节"
      );
    }

    if (/^Type or paste formatted text\.$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "输入或粘贴已格式化文本。"
      );
    }

    if (
      /^All works you post on AO3 must comply with our$/i.test(clean)
    ) {
      return replaceOnce(text, 
        clean,
        "你在 AO3 发布的所有作品都必须遵守我们的"
      );
    }

    if (
      /^For more information, please refer to our$/i.test(clean)
    ) {
      return replaceOnce(text, 
        clean,
        "更多信息请参阅我们的"
      );
    }

    if (/^Post Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "发布章节"
      );
    }

    if (/^Please wait\.\.\.$/.test(clean)) {
      return replaceOnce(text, 
        clean,
        "请稍候..."
      );
    }

    if (
      /^Warning: Unchecking this box will delete the existing beginning note\.$/.test(clean)
    ) {
      return replaceOnce(text, 
        clean,
        "警告：取消勾选后，将删除现有的开头备注。"
      );
    }

    if (
      /^Warning: Unchecking this box will delete the existing end note\.$/.test(clean)
    ) {
      return replaceOnce(text, 
        clean,
        "警告：取消勾选后，将删除现有的结尾备注。"
      );
    }

    if (/^Search Works$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "作品搜索"
      );
    }

    if (/^People Search$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "用户搜索"
      );
    }

    if (/^Bookmark Search$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "书签搜索"
      );
    }

    if (/^Tag Search$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "标签搜索"
      );
    }

    if (/^Work Info$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "作品信息"
      );
    }

    if (/^Any Field$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "任意字段"
      );
    }

    if (/^Completion status$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "完结状态"
      );
    }

    if (/^All works$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "所有作品"
      );
    }

    if (/^Complete works only$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "仅已完结作品"
      );
    }

    if (/^Works in progress only$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "仅连载中作品"
      );
    }

    if (/^Crossovers$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "跨作品"
      );
    }

    if (/^Include crossovers$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "包含跨作品"
      );
    }

    if (/^Exclude crossovers$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "排除跨作品"
      );
    }

    if (/^Only crossovers$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "仅跨作品"
      );
    }

    if (/^Single Chapter$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "单章节"
      );
    }

    if (/^Word Count$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "字数"
      );
    }

    if (/^Language$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "语言"
      );
    }

    if (/^Work Tags$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "作品标签"
      );
    }

    if (/^Rating$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "分级"
      );
    }

    if (/^Warnings$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "警告"
      );
    }

    if (/^Category$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "作品类型"
      );
    }

    if (/^Fandoms$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "原作"
      );
    }

    if (/^Relationships$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "关系"
      );
    }

    if (/^Characters$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "角色"
      );
    }

    if (/^Additional Tags$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "附加标签"
      );
    }

    if (/^Search within results$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "在结果中搜索"
      );
    }

    if (/^Sort by$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "排序方式"
      );
    }

    if (/^Gen$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "Gen（无CP）"
      );
    }

    if (/^F\/M$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "F/M（男女）"
      );
    }

    if (/^M\/M$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "M/M（男男）"
      );
    }

    if (/^F\/F$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "F/F（女女）"
      );
    }

    if (/^Multi$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "Multi（多配对）"
      );
    }

    if (/^Other$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "Other（其他）"
      );
    }

    if (/^Author Subscriptions$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "作者订阅"
      );
    }

    if (/^Subscribe$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "订阅更新"
      );
    }

    if (/^Unsubscribe$/i.test(clean)) {
      return replaceOnce(text, 
        clean,
        "取消订阅"
      );
    }

    const unsubFromMatch =
      clean.match(/^Unsubscribe from\s+(.+)$/i);

    if (unsubFromMatch) {
      return replaceOnce(text, 
        clean,
        `取消对 ${unsubFromMatch[1]} 的订阅`
      );
    }

    const subToMatch =
      clean.match(/^Subscribe to\s+(.+)$/i);

    if (subToMatch) {
      return replaceOnce(text, 
        clean,
        `订阅 ${subToMatch[1]} 的更新`
      );
    }

    const flashTranslated =
      translateFlashTemplate(clean);

    if (flashTranslated !== clean) {
      return replaceOnce(text, 
        clean,
        flashTranslated
      );
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

    out = out.replace(
      /（(\d+)\)/g,
      "（$1）"
    );

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
      [
        /^You have successfully unsubscribed from (.+)\.$/i,
        "你已成功取消订阅 $1。"
      ],
      [
        /^You have blocked the user (.+)\.$/i,
        "你已屏蔽用户 $1。"
      ],
      [
        /^You have muted the user (.+)\.$/i,
        "你已静音用户 $1。"
      ],
      [
        /^You have unmuted the user (.+)\.$/i,
        "你已解除对用户 $1 的静音。"
      ],
      [
        /^You have unblocked the user (.+)\.$/i,
        "你已解除对用户 $1 的屏蔽。"
      ],
      [
        /^You are now subscribed to (.+)\.$/i,
        "你已成功订阅 $1。"
      ],
      [
        /^You are already subscribed to (.+)\.$/i,
        "你已经订阅了 $1。"
      ],
      [
        /^Subscription saved\.$/i,
        "订阅已保存。"
      ],

      [
        /^Your comment has been posted\.$/i,
        "评论已发布。"
      ],
      [
        /^Your comment has been deleted\.$/i,
        "评论已删除。"
      ],
      [
        /^Your comment has been edited\.$/i,
        "评论已更新。"
      ],
      [
        /^Comments are closed for this work\.$/i,
        "此作品已关闭评论。"
      ],

      [
        /^Bookmark created\.$/i,
        "书签已创建。"
      ],
      [
        /^Bookmark updated\.$/i,
        "书签已更新。"
      ],
      [
        /^Bookmark deleted\.$/i,
        "书签已删除。"
      ],

      [
        /^Work posted successfully\.$/i,
        "作品已发布。"
      ],
      [
        /^Work updated successfully\.$/i,
        "作品已更新。"
      ],
      [
        /^Work deleted\.$/i,
        "作品已删除。"
      ],
      [
        /^Draft saved\.$/i,
        "草稿已保存。"
      ],

      [
        /^Chapter posted successfully\.$/i,
        "章节已发布。"
      ],
      [
        /^Chapter updated successfully\.$/i,
        "章节已更新。"
      ],
      [
        /^Chapter deleted\.$/i,
        "章节已删除。"
      ],

      [
        /^Work added to collection\.$/i,
        "作品已加入合集。"
      ],
      [
        /^Work removed from collection\.$/i,
        "作品已从合集移除。"
      ],
      [
        /^The pseud was successfully deleted\.$/i,
        "笔名已成功删除。"
      ],
      [
        /^The pseud was successfully created\.$/i,
        "笔名已成功创建。"
      ],
      [
        /^Pseud was successfully updated\.$/i,
        "笔名已成功更新。"
      ],
      [
        /^Your changes have been saved\.$/i,
        "更改已保存。"
      ],
      [
        /^Preferences updated\.$/i,
        "偏好设置已更新。"
      ],

      [
        /^Successfully logged in\.$/i,
        "登录成功。"
      ],
      [
        /^Successfully logged out\.$/i,
        "已退出登录。"
      ],
      [
        /^Account created successfully\.$/i,
        "账号创建成功。"
      ],

      [
        /^You are not authorized to do that\.$/i,
        "你没有权限执行此操作。"
      ],
      [
        /^Something went wrong\.$/i,
        "出现错误。"
      ],
      [
        /^Please try again\.$/i,
        "请重试。"
      ]
    ];

    for (const [regex, replacement] of rules) {
      if (regex.test(text)) {
        return text.replace(
          regex,
          replacement
        );
      }
    }

    return text;
  }

  function getControlText(el) {
    if (!el) return "";

    if (el instanceof HTMLInputElement) {
      return normalizeText(
        el.getAttribute("value") ||
        el.value ||
        ""
      );
    }

    return normalizeText(
      el.textContent ||
      ""
    );
  }

  function isHintableControl(el) {
    return (
      el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      (
        el instanceof HTMLAnchorElement &&
        (
          el.classList.contains("button") ||
          el.closest(
            ".actions, .navigation, #first-login-help-banner"
          )
        )
      )
    );
  }

  function getControlHintText(el) {
    if (!isHintableControl(el)) return "";

    if (el instanceof HTMLInputElement) {
      const type = (
        el.getAttribute("type") ||
        ""
      ).toLowerCase();

      if (
        !["button", "submit", "reset"].includes(type)
      ) {
        return "";
      }
    }

    const text = getControlText(el);

    return CONTROL_HINTS[text] || "";
  }

  function isHintOnlyControl(el) {
    if (
      el instanceof HTMLInputElement &&
      (
        el.getAttribute("type") ||
        ""
      ).toLowerCase() === "submit"
    ) {
      return false;
    }

    return Boolean(
      getControlHintText(el)
    );
  }

  function upsertControlHint(el) {
    const hintText =
      getControlHintText(el);

    if (!hintText) return;

    if (
      el.offsetParent === null &&
      !el.closest("#tos_prompt")
    ) {
      return;
    }

    if (el.hasAttribute(MARK)) return;

    if (el instanceof HTMLInputElement) {
      const type = (
        el.getAttribute("type") ||
        ""
      ).toLowerCase();

      if (type === "submit") return;

      el.value = hintText;
    } else {
      safeSetText(
        el,
        hintText
      );
    }

    el.setAttribute(
      MARK,
      "1"
    );
  }

  function applyControlHints(root = document.body) {
    root.querySelectorAll(
      "button, " +
      "input[type='button'], " +
      "input[type='submit'], " +
      "input[type='reset'], " +
      "a.button, " +
      ".actions a"
    ).forEach(upsertControlHint);
  }

  // 把 input[type="submit"] 转换为 button[type="submit"]。
  // 英文 value 保留给 AO3，中文 textContent 显示给用户。
  function replaceSubmitInput(el) {
    if (!(el instanceof HTMLInputElement)) {
      return;
    }

    const type = (
      el.getAttribute("type") ||
      ""
    ).toLowerCase();

    if (type !== "submit") return;
    if (el.hasAttribute(MARK)) return;

    const originalValue =
      el.getAttribute("value") ||
      el.value ||
      "";

    if (!originalValue) return;

    const chineseLabel =
      translateTextValue(originalValue);

    if (
      !chineseLabel ||
      chineseLabel === originalValue
    ) {
      return;
    }

    const btn =
      document.createElement("button");

    btn.type = "submit";
    btn.value = originalValue;
    btn.textContent = chineseLabel;

    btn.setAttribute(
      "data-ao3-original-value",
      originalValue
    );

    if (el.name) {
      btn.name = el.name;
    }

    btn.className = el.className;

    if (el.id) {
      btn.id = el.id;
    }

    if (el.disabled) {
      btn.disabled = true;
    }

    const formAttr =
      el.getAttribute("form");

    if (formAttr) {
      btn.setAttribute(
        "form",
        formAttr
      );
    }

    for (const { name, value } of el.attributes) {
      if (
        ![
          "type",
          "value",
          "name",
          "id",
          "class",
          "disabled",
          "form"
        ].includes(name)
      ) {
        try {
          btn.setAttribute(name, value);
        } catch (_) {
          // 忽略无法复制的属性。
        }
      }
    }

    el.setAttribute(
      MARK,
      "1"
    );

    el.parentNode?.replaceChild(
      btn,
      el
    );

    btn.setAttribute(
      MARK,
      "1"
    );
  }

  function translateFlashMessages(root = document.body) {
    const flashes = root.querySelectorAll(
      ".flash, " +
      ".flash.notice, " +
      ".flash.success, " +
      ".flash.alert, " +
      ".flash.error"
    );

    flashes.forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const text = normalizeText(
        el.textContent ||
        ""
      );

      if (!text) return;

      const translated =
        translateFlashTemplate(text);

      if (translated !== text) {
        safeSetText(
          el,
          translated
        );

        el.setAttribute(
          MARK,
          "1"
        );
      }
    });
  }
  
  function translateTextNodes(root = document.body) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;

    while ((node = walker.nextNode())) {
      const parent =
        node.parentElement;

      if (!parent) continue;
      if (parent.hasAttribute(MARK)) continue;
      if (shouldSkipElement(parent)) continue;

      const control = parent.closest(
        "button, a.button, .actions a"
      );

      if (
        control &&
        isHintOnlyControl(control)
      ) {
        continue;
      }

      const original =
        node.nodeValue;

      const clean =
        normalizeText(original);

      if (!clean) continue;

      const translated =
        translateTextValue(original);

      if (translated !== original) {
        node.nodeValue = translated;
      }
    }
  }

  function translateInputs(root = document.body) {
    const fields = root.querySelectorAll(
      "input, textarea, select, option, button, " +
      "label, legend, h1, h2, h3, h4, h5, h6, " +
      "a, span, dt, dd, p"
    );

    fields.forEach(el => {
      if (el.hasAttribute(MARK)) return;
      // textarea 的正文不翻译，但 placeholder 需要处理。
      if (shouldSkipElement(el) && !(el instanceof HTMLTextAreaElement)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement
      ) {
        const name =
          el.getAttribute("name");

        const placeholder =
          el.getAttribute("placeholder");

        if (
          name &&
          DICT.placeholders &&
          DICT.placeholders[name]
        ) {
          el.setAttribute(
            "placeholder",
            DICT.placeholders[name]
          );

          el.setAttribute(
            MARK,
            "1"
          );
        } else if (placeholder) {
          const translatedPlaceholder =
            translateTextValue(placeholder);

          if (
            translatedPlaceholder !== placeholder
          ) {
            el.setAttribute(
              "placeholder",
              translatedPlaceholder
            );

            el.setAttribute(
              MARK,
              "1"
            );
          }
        }

        replaceSubmitInput(el);
      }

      if (el instanceof HTMLButtonElement) {
        const text =
          el.textContent ||
          "";

        const translatedText =
          translateTextValue(text);

        if (translatedText !== text) {
          safeSetText(
            el,
            translatedText.trim()
          );

          el.setAttribute(
            MARK,
            "1"
          );
        }
      }

      if (el.tagName === "A") {
        const text =
          el.textContent ||
          "";

        const translatedText =
          translateTextValue(text);

        if (translatedText !== text) {
          safeSetText(
            el,
            translatedText.trim()
          );

          el.setAttribute(
            MARK,
            "1"
          );
        }
      }

      ["aria-label", "title"].forEach(attr => {
        const value =
          el.getAttribute(attr);

        if (!value) return;

        const translated =
          translateTextValue(value);

        if (translated !== value) {
          el.setAttribute(
            attr,
            translated
          );

          el.setAttribute(
            MARK,
            "1"
          );
        }
      });
    });
  }

  function translateMetaSection() {
    const meta =
      document.querySelector(
        "dl.work.meta.group"
      );

    if (!meta) return;

    meta.querySelectorAll("dt").forEach(dt => {
      if (dt.hasAttribute(MARK)) return;

      const original =
        dt.textContent ||
        "";

      const translated =
        translateTextValue(original);

      if (translated !== original) {
        safeSetText(
          dt,
          translated.trim()
        );
      }

      dt.setAttribute(
        MARK,
        "1"
      );
    });

    meta.querySelectorAll("dd").forEach(dd => {
      if (dd.hasAttribute(MARK)) return;

      const klass =
        dd.className ||
        "";

      const text = normalizeText(
        dd.textContent ||
        ""
      );

      const safeClasses = [
        "rating",
        "warning",
        "category",
        "language"
      ];

      if (
        safeClasses.some(
          className =>
            klass.includes(className)
        )
      ) {
        dd.querySelectorAll("*").forEach(child => {
          if (child.children.length !== 0) {
            return;
          }

          const childText =
            child.textContent ||
            "";

          const translatedChildText =
            translateTextValue(childText);

          if (
            translatedChildText !== childText
          ) {
            child.textContent =
              translatedChildText;
          }
        });

        const translated =
          translateTextValue(text);

        if (
          translated !== text &&
          dd.children.length === 0
        ) {
          dd.textContent = translated;
        }

        dd.setAttribute(
          MARK,
          "1"
        );
      }

      if (klass.includes("stats")) {
        dd.querySelectorAll(
          "dt, dd"
        ).forEach(item => {
          if (item.hasAttribute(MARK)) return;

          const itemText =
            item.textContent ||
            "";

          const translatedItemText =
            translateTextValue(itemText);

          if (
            translatedItemText !== itemText
          ) {
            safeSetText(
              item,
              translatedItemText.trim()
            );
          }

          item.setAttribute(
            MARK,
            "1"
          );
        });
      }
    });
  }

  function translateWorksNew() {
    const path =
      location.pathname ||
      "";

    const isWorkNew =
      /^\/works\/new\/?$/.test(path);

    const isChapterNew =
      /^\/works\/\d+\/chapters\/new\/?$/.test(path);

    if (!isWorkNew && !isChapterNew) {
      return;
    }

    document.querySelectorAll(
      "#main h1, " +
      "#main h2, " +
      "#main h3, " +
      "#main h4, " +
      "#main legend, " +
      "#main legend.required, " +
      "#main label, " +
      "#main dt, " +
      "#main dd, " +
      "#main p.note, " +
      "#main p.notice, " +
      "#main p.required.notice, " +
      "#main .notice, " +
      "#main span"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      const original =
        el.textContent ||
        "";

      const translated =
        translateTextValue(original);

      if (translated !== original) {
        safeSetText(
          el,
          translated.trim()
        );
      }

      el.setAttribute(
        MARK,
        "1"
      );
    });

    document.querySelectorAll(
      "#main input, " +
      "#main textarea, " +
      "#main button, " +
      "#main option, " +
      "#main a, " +
      "#main select"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      const placeholder =
        el.getAttribute("placeholder");

      const title =
        el.getAttribute("title");

      const aria =
        el.getAttribute("aria-label");

      const text =
        el.textContent ||
        "";

      replaceSubmitInput(el);

      if (placeholder) {
        const translatedPlaceholder =
          translateTextValue(placeholder);

        if (
          translatedPlaceholder !== placeholder
        ) {
          el.setAttribute(
            "placeholder",
            translatedPlaceholder
          );
        }
      }

      if (title) {
        const translatedTitle =
          translateTextValue(title);

        if (translatedTitle !== title) {
          el.setAttribute(
            "title",
            translatedTitle
          );
        }
      }

      if (aria) {
        const translatedAria =
          translateTextValue(aria);

        if (translatedAria !== aria) {
          el.setAttribute(
            "aria-label",
            translatedAria
          );
        }
      }

      if (
        el.tagName === "A" ||
        el.tagName === "BUTTON" ||
        el.tagName === "OPTION" ||
        el.tagName === "SPAN"
      ) {
        const translatedText =
          translateTextValue(text);

        if (translatedText !== text) {
          safeSetText(
            el,
            translatedText.trim()
          );
        }
      }

      el.setAttribute(
        MARK,
        "1"
      );
    });

    document.querySelectorAll(
      "#main .rtf-notes"
    ).forEach(el => {
      const html =
        el.innerHTML;

      const replaced = html.replace(
        "Type or paste formatted text.",
        "输入或粘贴已格式化文本。"
      );

      if (replaced !== html) {
        el.innerHTML = replaced;
      }
    });

    document.querySelectorAll(
      "#main p.notice"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;

      const html =
        el.innerHTML;

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
    const path =
      location.pathname ||
      "";

    if (
      !/^\/works\/search\/?$/.test(path)
    ) {
      return;
    }

    document.querySelectorAll(
      "#main h1, " +
      "#main h2, " +
      "#main h3, " +
      "#main h4, " +
      "#main legend, " +
      "#main dt, " +
      "#main dd, " +
      "#main label, " +
      "#main span, " +
      "#main option, " +
      "#main button, " +
      "#main a, " +
      "#main p"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      const text =
        el.textContent ||
        "";

      const translated =
        translateTextValue(text);

      if (translated !== text) {
        safeSetText(
          el,
          translated.trim()
        );
      }

      el.setAttribute(
        MARK,
        "1"
      );
    });

    document.querySelectorAll(
      "#main input, " +
      "#main textarea, " +
      "#main select, " +
      "#main a"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;
      if (shouldSkipElement(el)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      const placeholder =
        el.getAttribute("placeholder");

      const title =
        el.getAttribute("title");

      const aria =
        el.getAttribute("aria-label");

      replaceSubmitInput(el);

      if (placeholder) {
        const translatedPlaceholder =
          translateTextValue(placeholder);

        if (
          translatedPlaceholder !== placeholder
        ) {
          el.setAttribute(
            "placeholder",
            translatedPlaceholder
          );
        }
      }

      if (title) {
        const translatedTitle =
          translateTextValue(title);

        if (translatedTitle !== title) {
          el.setAttribute(
            "title",
            translatedTitle
          );
        }
      }

      if (aria) {
        const translatedAria =
          translateTextValue(aria);

        if (translatedAria !== aria) {
          el.setAttribute(
            "aria-label",
            translatedAria
          );
        }
      }

      el.setAttribute(
        MARK,
        "1"
      );
    });
  }

  function translateSubscriptionsPage() {
    const path =
      location.pathname ||
      "";

    if (
      !/^\/users\/[^/]+\/subscriptions\/?$/.test(path)
    ) {
      return;
    }

    const roots =
      document.querySelectorAll(
        "#dashboard, " +
        "#main, " +
        "#main .subscriptions, " +
        "#main .listbox"
      );

    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll(
        "h1, h2, h3, h4, a, button, " +
        "label, legend, p, span, th, td, " +
        "li, dt, dd, input"
      ).forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (shouldSkipElement(el)) return;

        if (isHintOnlyControl(el)) {
          upsertControlHint(el);
          return;
        }

        const text =
          el.textContent ||
          "";

        const translated =
          translateTextValue(text);

        replaceSubmitInput(el);

        if (
          translated !== text &&
          !el.matches("input")
        ) {
          safeSetText(
            el,
            translated.trim()
          );
        }

        const title =
          el.getAttribute("title");

        if (title) {
          const translatedTitle =
            translateTextValue(title);

          if (
            translatedTitle !== title
          ) {
            el.setAttribute(
              "title",
              translatedTitle
            );
          }
        }

        const aria =
          el.getAttribute("aria-label");

        if (aria) {
          const translatedAria =
            translateTextValue(aria);

          if (
            translatedAria !== aria
          ) {
            el.setAttribute(
              "aria-label",
              translatedAria
            );
          }
        }

        el.setAttribute(
          MARK,
          "1"
        );
      });
    });
  }

  function translateCommentUI() {
    const roots =
      document.querySelectorAll(
        "#feedback, " +
        "#comments, " +
        ".comments, " +
        ".comment, " +
        ".thread, " +
        "form[action*='/comments']"
      );

    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll(
        "h3, h4, h5, a, button, label, " +
        "legend, input, textarea, p, span, li"
      ).forEach(el => {
        if (el.hasAttribute(MARK)) return;

        // 评论正文（blockquote.userstuff）和用户名不能被改写。
        if (shouldSkipElement(el) && !(el instanceof HTMLTextAreaElement)) return;

        if (
          el.closest(`.${TL_CLASS}`)
        ) {
          return;
        }

        if (isHintOnlyControl(el)) {
          upsertControlHint(el);
          return;
        }

        const text =
          el.textContent ||
          "";

        const placeholder =
          el.getAttribute("placeholder");

        const title =
          el.getAttribute("title");

        const aria =
          el.getAttribute("aria-label");

        if (
          !el.matches("input, textarea")
        ) {
          const translatedText =
            translateTextValue(text);

          if (
            translatedText !== text
          ) {
            safeSetText(
              el,
              translatedText.trim()
            );
          }
        }

        if (placeholder) {
          const translatedPlaceholder =
            translateTextValue(placeholder);

          if (
            translatedPlaceholder !== placeholder
          ) {
            el.setAttribute(
              "placeholder",
              translatedPlaceholder
            );
          }
        } else if (
          el instanceof HTMLTextAreaElement
        ) {
          const name =
            el.getAttribute("name") ||
            "";

          if (name.includes("comment")) {
            el.setAttribute(
              "placeholder",
              "输入评论内容"
            );
          }
        }

        if (title) {
          const translatedTitle =
            translateTextValue(title);

          if (
            translatedTitle !== title
          ) {
            el.setAttribute(
              "title",
              translatedTitle
            );
          }
        }

        if (aria) {
          const translatedAria =
            translateTextValue(aria);

          if (
            translatedAria !== aria
          ) {
            el.setAttribute(
              "aria-label",
              translatedAria
            );
          }
        }

        el.setAttribute(
          MARK,
          "1"
        );
      });
    });
  }

  function forceTranslateCommentActionLinks() {
    document.querySelectorAll(
      "#feedback a, " +
      "#comments a, " +
      ".comment a, " +
      ".thread a, " +
      "#feedback button, " +
      "#comments button, " +
      ".comment button, " +
      ".thread button"
    ).forEach(el => {
      if (shouldSkipElement(el)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      const text = (
        el.textContent ||
        ""
      ).trim();

      if (!text) return;

      const translated =
        translateTextValue(text);

      if (translated !== text) {
        safeSetText(
          el,
          translated
        );

        el.setAttribute(
          MARK,
          "1"
        );
      }
    });
  }

  // 处理首次服务条款确认页中包含多个链接的说明文字。
  function translateTosPromptAgreementNotice() {
    const agreement =
      document.querySelector(
        "#tos_prompt .agreement"
      );

    if (!agreement) return;

    agreement.querySelectorAll(
      ":scope > p"
   ).forEach(container => {
      const links =
       Array.from(
          container.querySelectorAll("a")
        );

      // 第一段：
      // ...and other Content.
      const contentDefinitionLink =
        links.find(link => {
         try {
           const url = new URL(
              link.getAttribute("href") || "",
              location.origin
            );

            return (
              url.pathname === "/tos_faq" &&
              url.hash === "#define_content"
            );
          } catch (_) {
            return false;
          }
        });

      if (contentDefinitionLink) {
        // 原文措辞变了（或已翻译过）就不要用写死的译文覆盖
        if (
          !/^On the Archive of Our Own/.test(
            normalizeText(container.textContent)
          )
        ) {
          return;
        }

        contentDefinitionLink.textContent =
         "内容";

        contentDefinitionLink.setAttribute(
         MARK,
          "1"
        );

        container.textContent = "";

        container.appendChild(
          document.createTextNode(
           "在 Archive of Our Own（AO3）上，用户可以创建作品、书签、评论、标签及其他"
          )
        );

        container.appendChild(
         contentDefinitionLink
        );

        container.appendChild(
         document.createTextNode(
            "。你在 AO3 上发布的任何信息，可能会被公众、AO3 用户和/或 AO3 工作人员访问。" +
            "分享个人信息时请谨慎，包括但不限于你的姓名、邮箱、年龄、所在地、个人关系、" +
           "性别或性向认同、种族或族裔背景、宗教或政治观点，以及其他网站的账号用户名。"
         )
        );

        container.setAttribute(
         MARK,
         "1"
        );

       return;
      }

      // 第二段：
      // To learn more, check out our Terms of Service,
      // including the Content Policy and Privacy Policy.
      const tosLink =
       links.find(link => {
         try {
           return (
              new URL(
                link.getAttribute("href") || "",
                location.origin
              ).pathname === "/tos"
           );
         } catch (_) {
           return false;
         }
       });

      const contentPolicyLink =
       links.find(link => {
          try {
           return (
             new URL(
               link.getAttribute("href") || "",
               location.origin
             ).pathname === "/content"
           );
         } catch (_) {
           return false;
         }
        });

      const privacyLink =
       links.find(link => {
         try {
           return (
              new URL(
               link.getAttribute("href") || "",
               location.origin
              ).pathname === "/privacy"
           );
         } catch (_) {
            return false;
         }
        });

      if (
       !tosLink ||
       !contentPolicyLink ||
       !privacyLink ||
       !/^To learn more, check out our/.test(
         normalizeText(container.textContent)
       )
     ) {
        return;
     }

      tosLink.textContent =
       "服务条款";

      contentPolicyLink.textContent =
       "内容政策";

      privacyLink.textContent =
       "隐私政策";

      [
        tosLink,
        contentPolicyLink,
        privacyLink
      ].forEach(link => {
        link.setAttribute(
         MARK,
         "1"
        );
      });

      container.textContent = "";

      container.appendChild(
        document.createTextNode(
          "如需了解更多，请查看我们的"
        )
     );

      container.appendChild(
       tosLink
      );

      container.appendChild(
        document.createTextNode(
          "，包括"
        )
      );

      container.appendChild(
        contentPolicyLink
      );

      container.appendChild(
        document.createTextNode(
          "和"
        )
      );

      container.appendChild(
        privacyLink
      );

      container.appendChild(
        document.createTextNode(
          "。"
        )
      );

      container.setAttribute(
       MARK,
       "1"
      );
    });
  }

  // 处理邀请申请页面顶部包含多个链接的说明文字。
  function translateInviteRequestIntroNotice() {
    if (
      !/^\/invite_requests\/?$/.test(
        location.pathname
      )
    ) {
      return;
    }

    const main = document.querySelector(
      "#main.invite_requests-index"
    );

    if (!main) return;
  
    main.querySelectorAll(
      ":scope > p"
    ).forEach(container => {
      const links =
        Array.from(
          container.querySelectorAll("a")
        );

     const tosLink =
        links.find(link => {
          try {
            return (
              new URL(
                link.getAttribute("href") || "",
                location.origin
              ).pathname === "/tos"
            );
          } catch (_) {
            return false;
          }
        });

      const contentPolicyLink =
        links.find(link => {
          try {
            return (
              new URL(
                link.getAttribute("href") || "",
                location.origin
              ).pathname === "/content"
            );
          } catch (_) {
            return false;
          }
        });

      const privacyLink =
        links.find(link => {
          try {
            return (
              new URL(
                link.getAttribute("href") || "",
                location.origin
              ).pathname === "/privacy"
            );
          } catch (_) {
            return false;
          }
        });

      // 只有同时包含这三个链接的说明段落才处理。
      if (
        !tosLink ||
        !contentPolicyLink ||
        !privacyLink
     ) {
        return;
      }

      const fullText =
        normalizeText(
          container.textContent || ""
        );

      // 同时兼容原始英文状态和已经被通用词典部分汉化的状态。
      if (
        !/To get a free Archive of Our Own/i.test(fullText) &&
        !/要获得一个免费的 Archive of Our Own/i.test(fullText)
      ) {
        return;
      }

      tosLink.textContent =
        "服务条款";

      contentPolicyLink.textContent =
        "内容政策";

      privacyLink.textContent =
        "隐私政策";

      tosLink.setAttribute(
        MARK,
        "1"
      );

      contentPolicyLink.setAttribute(
        MARK,
        "1"
      );

      privacyLink.setAttribute(
        MARK,
        "1"
      );

      container.textContent = "";

      container.appendChild(
        document.createTextNode(
          "要获得一个免费的 Archive of Our Own（AO3）账号，你需要一封邀请邮件。" +
          "将你的电子邮箱地址提交到我们的邀请申请队列，即表示你确认自己至少已满13岁；" +
          "如果你所在国家或地区规定居民或公民必须年满13岁以上，才能自行同意个人数据的处理，" +
          "则表示你同时确认自己已达到可以在无需父母或法定监护人的书面许可的情况下，" +
          "同意我们处理你的个人数据的年龄。" +
          "我们只会将你提交的电子邮箱地址用于向你发送邀请，以及处理和管理你的账号激活。" +
          "在申请邀请之前，请先阅读我们的"
        )
      );

      container.appendChild(
        tosLink
      );

      container.appendChild(
        document.createTextNode(
          "，包括"
        )
      );

      container.appendChild(
        contentPolicyLink
      );

      container.appendChild(
        document.createTextNode(
          "和"
        )
      );

      container.appendChild(
        privacyLink
      );

      container.appendChild(
        document.createTextNode(
          "，并同意遵守这些条款。"
        )
      );

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理屏蔽用户页面中指向“已静音用户”页面的提示和确认提示。
  function translateBlockedUsersNotice() {
    if (
      !/^\/users\/[^/]+\/blocked\/users(?:\/confirm_block)?\/?$/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main .notice p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      // 处理确认屏蔽提示。
      // 原文中的 block 被 strong 元素包裹，因此重建整个段落。
      const confirmBlockMatch =
        fullText.match(
          /^Are you sure you want to block (.+?)\? Blocking a user prevents them from:$/i
        );

      if (confirmBlockMatch) {
        const username =
          confirmBlockMatch[1];

        container.textContent =
          `你确定要屏蔽 ${username} 吗？屏蔽用户后，对方将无法：`;

        container.setAttribute(
          MARK,
          "1"
        );

        return;
      }

      // 处理指向“已静音用户”页面的提示。
      const mutedUsersLink = Array
        .from(
          container.querySelectorAll("a")
        )
        .find(link => {
          try {
            const path = new URL(
              link.getAttribute("href") || "",
              location.origin
            ).pathname;

            return (
              /^\/users\/[^/]+\/muted\/users\/?$/.test(
                path
              )
            );
          } catch (_) {
            return false;
          }
        });

      if (!mutedUsersLink) return;

      if (
        !/^To hide a user['’]s works, bookmarks, series, and comments from you, visit your Muted Users page\.$/i.test(
          fullText
        )
      ) {
        return;
      }

      mutedUsersLink.textContent =
        "已静音用户页面";

      mutedUsersLink.setAttribute(
        MARK,
        "1"
      );

      container.textContent = "";

      container.appendChild(
        document.createTextNode(
          "如果需要隐藏某位用户的作品、书签、系列和评论，请前往你的"
        )
      );

      container.appendChild(
        mutedUsersLink
      );

      container.appendChild(
        document.createTextNode("。")
      );

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理确认解除屏蔽用户页面。
  function translateUnblockUserNotice() {
    const main = document.querySelector(
      "#main.users-confirm_unblock"
    );

    if (!main) return;

    // 翻译动态标题：
    // Unblock 用户名
    const heading =
      main.querySelector("h2.heading");

    if (heading) {
      const headingText =
        normalizeText(
          heading.textContent || ""
        );

      const headingMatch =
        headingText.match(
          /^Unblock\s+(.+)$/i
        );

      if (headingMatch) {
        heading.textContent =
          `解除屏蔽 ${headingMatch[1]}`;

        heading.setAttribute(
          MARK,
          "1"
        );
      }
    }

    // 翻译确认提示。
    // 原文中的 unblock 被 strong 元素包裹，
    // 因此需要读取完整 textContent 后重建段落。
    main.querySelectorAll(
      ".notice p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      const confirmMatch =
        fullText.match(
          /^Are you sure you want to unblock (.+?)\? Unblocking a user allows them to resume:$/i
        );

      if (!confirmMatch) return;

      const username =
        confirmMatch[1];

      container.textContent =
        `你确定要解除对 ${username} 的屏蔽吗？解除屏蔽后，对方即可恢复以下操作：`;

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理确认静音用户页面。
  function translateMuteUserNotice() {
    const main = document.querySelector(
      "#main.users-confirm_mute"
    );

    if (!main) return;

    // 翻译动态标题：
    // Mute 用户名
    const heading =
      main.querySelector("h2.heading");

    if (heading) {
      const headingText =
        normalizeText(
          heading.textContent || ""
        );

      const headingMatch =
        headingText.match(
          /^Mute\s+(.+)$/i
        );

      if (headingMatch) {
        heading.textContent =
          `静音 ${headingMatch[1]}`;

        heading.setAttribute(
          MARK,
          "1"
        );
      }
    }

    // 翻译确认提示。
    // 原文中的 mute 被 strong 元素包裹，
    // 因此读取完整 textContent 后重建段落。
    main.querySelectorAll(
      ".notice p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      const confirmMatch =
        fullText.match(
          /^Are you sure you want to mute (.+?)\? Muting a user:$/i
        );

      if (!confirmMatch) return;

      const username =
        confirmMatch[1];

      container.textContent =
        `你确定要静音 ${username} 吗？静音该用户后：`;

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理确认解除静音用户页面。
  function translateUnmuteUserNotice() {
    const main = document.querySelector(
      "#main.users-confirm_unmute"
    );

    if (!main) return;

    // 翻译动态标题：
    // Unmute 用户名
    const heading =
      main.querySelector("h2.heading");

    if (heading) {
      const headingText =
        normalizeText(
          heading.textContent || ""
        );

      const headingMatch =
        headingText.match(
          /^Unmute\s+(.+)$/i
        );

      if (headingMatch) {
        heading.textContent =
          `解除静音 ${headingMatch[1]}`;

        heading.setAttribute(
          MARK,
          "1"
        );
      }
    }

    // 翻译确认提示。
    // 原文中的 unmute 被 strong 元素包裹，
    // 因此读取完整 textContent 后重建段落。
    main.querySelectorAll(
      ".notice p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      const confirmMatch =
        fullText.match(
          /^Are you sure you want to unmute (.+?)\? Unmuting a user allows you to:$/i
        );

      if (!confirmMatch) return;

      const username =
        confirmMatch[1];

      container.textContent =
        `你确定要解除对 ${username} 的静音吗？解除静音后，你将可以：`;

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

   // 处理静音用户列表页和确认静音页中包含链接的说明文字。
  function translateMutedUsersNotice() {
    const main = document.querySelector(
      "#main"
    );

    if (!main) return;

    const isMutedUsersIndex =
      /^\/users\/[^/]+\/muted\/users\/?$/.test(
        location.pathname
      );

    const isConfirmMute =
      main.classList.contains(
        "users-confirm_mute"
      );

    if (
      !isMutedUsersIndex &&
      !isConfirmMute
    ) {
      return;
    }

    main.querySelectorAll(
      ".notice p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      // 处理指向“已屏蔽用户”页面的提示。
      const blockedUsersLink = Array
        .from(
          container.querySelectorAll("a")
        )
        .find(link => {
          try {
            const url = new URL(
              link.getAttribute("href") || "",
              location.origin
            );

            return (
              /^\/users\/[^/]+\/blocked\/users\/?$/.test(
                url.pathname
              )
            );
          } catch (_) {
            return false;
          }
        });

      if (
        blockedUsersLink &&
        /^To prevent a user from commenting on your works or replying to your comments elsewhere on the site, visit your Blocked Users page\.$/i.test(
          fullText
        )
      ) {
        blockedUsersLink.textContent =
          "已屏蔽用户页面";

        blockedUsersLink.setAttribute(
          MARK,
          "1"
        );

        container.textContent = "";

        container.appendChild(
          document.createTextNode(
            "若要阻止某位用户在你的作品下发表评论，或在网站其他位置回复你的评论，请前往你的"
          )
        );

        container.appendChild(
          blockedUsersLink
        );

        container.appendChild(
          document.createTextNode("。")
        );

        container.setAttribute(
          MARK,
          "1"
        );

        return;
      }

      // 处理指向“恢复默认站点皮肤”说明的提示。
      const siteSkinFaqLink = Array
        .from(
          container.querySelectorAll("a")
        )
        .find(link => {
          try {
            const url = new URL(
              link.getAttribute("href") || "",
              location.origin
            );

            return (
              /^\/faq\/skins-and-archive-interface\/?$/.test(
                url.pathname
              ) &&
              url.hash ===
                "#restoresiteskin"
            );
          } catch (_) {
            return false;
          }
        });

      if (
        siteSkinFaqLink &&
        /^Please note that if you are not using the default site skin, muting may not work properly\. The Skins and Archive Interface FAQ has instructions for reverting to the default site skin\.$/i.test(
          fullText
        )
      ) {
        siteSkinFaqLink.textContent =
          "恢复默认站点皮肤的操作说明";

        // 明确链接到简体中文 FAQ。
        siteSkinFaqLink.setAttribute(
          "href",
          "/faq/skins-and-archive-interface?language_id=zh-Hans#restoresiteskin"
        );

        siteSkinFaqLink.setAttribute(
          MARK,
          "1"
        );

        container.textContent = "";
  
        container.appendChild(
          document.createTextNode(
            "请注意，如果你使用的不是默认站点皮肤，静音功能可能无法正常生效。" +
            "常见问题（FAQ）的“AO3 界面”栏目提供了"
          )
        );

       container.appendChild(
          siteSkinFaqLink
        );

        container.appendChild(
          document.createTextNode("。")
        );

        container.setAttribute(
          MARK,
          "1"
        );
      }
    });
  }

  // 处理邀请申请页面中的等待名单状态提示。
  function translateInviteRequestStatusNotice() {
    if (
      !/^\/invite_requests\/?$/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main.invite_requests-index p"
    ).forEach(container => {
      const fullText =
        normalizeText(
          container.textContent || ""
        );

      const statusLink = Array
        .from(
          container.querySelectorAll("a")
        )
        .find(link => {
          try {
            const url = new URL(
              link.getAttribute("href") || "",
              location.origin
            );

            return (
              /^\/invite_requests\/status\/?$/.test(
                url.pathname
              )
            );
          } catch (_) {
            return false;
          }
        });

      if (!statusLink) return;

      const match =
        fullText.match(
          /^If you have already requested an invitation, you can check your position on the waiting list\. There are currently ([\d,]+) people on the waiting list\. We are sending out ([\d,]+) invitations every ([\d.]+) hours\.$/i
        );

      if (!match) return;

      const waitingCount =
        match[1];

      const invitationCount =
        match[2];

      const hours =
        match[3];

      statusLink.textContent =
        "查看你在等待名单中的位置";

      statusLink.setAttribute(
        MARK,
        "1"
      );

      container.textContent = "";

      container.appendChild(
        document.createTextNode(
          "如果你已经申请过邀请，可以"
        )
      );

      container.appendChild(
        statusLink
      );

      container.appendChild(
        document.createTextNode(
          `。目前等待名单中共有 ${waitingCount} 人。我们每 ${hours} 小时发送 ${invitationCount} 封邀请邮件。`
        )
      );

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理“与用户名相同的笔名无法修改”提示。
  function translatePseudUsernameNotice() {
    if (
      !/^\/users\/[^/]+\/pseuds(?:\/|$)/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main p, #main .footnote"
    ).forEach(container => {
      if (container.hasAttribute(MARK)) {
        return;
      }

      const usernameLink = Array
        .from(container.querySelectorAll("a"))
        .find(link => {
          try {
            const path = new URL(
              link.getAttribute("href") || "",
              location.origin
            ).pathname;

            return (
              /^\/users\/[^/]+\/change_username\/?$/.test(path)
            );
          } catch (_) {
            return false;
          }
        });

      if (!usernameLink) return;

      const fullText = normalizeText(
        container.textContent ||
        ""
      );

      if (
        !/^You cannot change the pseud that matches your username\. However, you can change your username instead\.$/i.test(fullText)
      ) {
        return;
      }

      usernameLink.textContent =
        "修改用户名";

      usernameLink.setAttribute(
        MARK,
        "1"
      );

      container.textContent = "";

      container.appendChild(
        document.createTextNode(
          "与用户名相同的笔名无法修改。不过，你可以"
        )
      );

      container.appendChild(
        usernameLink
      );

      container.appendChild(
        document.createTextNode("。")
      );

      container.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 翻译笔名页面上的 Show / Edit Pseud。
  function translatePseudActionLinks() {
    if (
      !/^\/users\/[^/]+\/pseuds(?:\/|$)/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main a"
    ).forEach(link => {
      if (link.hasAttribute(MARK)) return;

      let path;

      try {
        path = new URL(
          link.getAttribute("href") || "",
          location.origin
        ).pathname;
      } catch (_) {
        return;
      }

      const text =
        normalizeText(
          link.textContent ||
          ""
        );

      if (
        text === "Show" &&
        /^\/users\/[^/]+\/pseuds\/[^/]+\/?$/.test(path)
      ) {
        link.textContent =
          "查看笔名页";

        link.setAttribute(
          MARK,
          "1"
        );

        return;
      }

      if (
        text === "Edit Pseud" &&
        /^\/users\/[^/]+\/pseuds\/[^/]+\/edit\/?$/.test(path)
      ) {
        link.textContent =
          "编辑笔名";

        link.setAttribute(
          MARK,
          "1"
        );
      }
    });
  }

  // 将原生文件选择控件改为中文界面。
  function localizePseudFileInput() {
    const path =
      location.pathname ||
      "";

    const isPseudForm =
      /^\/users\/[^/]+\/pseuds\/new\/?$/.test(path) ||
      /^\/users\/[^/]+\/pseuds\/[^/]+\/edit\/?$/.test(path);

    if (!isPseudForm) return;

    document.querySelectorAll(
      "#main input[type='file']"
    ).forEach((input, index) => {
      if (
        !(input instanceof HTMLInputElement)
      ) {
        return;
      }

      if (
        input.dataset.ao3ZhFileLocalized === "1"
      ) {
        return;
      }

      input.dataset.ao3ZhFileLocalized = "1";

      if (!input.id) {
        input.id =
          `ao3-zh-pseud-icon-${index}`;
      }

      input.classList.add(
        "ao3-zh-native-file-input"
      );

      input.tabIndex = -1;

      input.setAttribute(
        MARK,
        "1"
      );

      const wrapper =
        document.createElement("span");

      wrapper.className =
        "ao3-zh-file-control";

      wrapper.setAttribute(
        MARK,
        "1"
      );

      const button =
        document.createElement("button");

      button.type = "button";
      button.textContent = "选择文件";
      button.disabled = input.disabled;

      button.setAttribute(
        "aria-controls",
        input.id
      );

      button.setAttribute(
        MARK,
        "1"
      );

      const fileName =
        document.createElement("span");

      fileName.className =
        "ao3-zh-file-name";

      fileName.textContent =
        "未选择文件";

      fileName.setAttribute(
        "aria-live",
        "polite"
      );

      fileName.setAttribute(
        MARK,
        "1"
      );

      button.addEventListener(
        "click",
        () => {
          if (!input.disabled) {
            input.click();
          }
        }
      );

      input.addEventListener(
        "change",
        () => {
          const selectedFiles =
            Array.from(input.files || []);

          fileName.textContent =
            selectedFiles.length
              ? selectedFiles
                  .map(file => file.name)
                  .join(", ")
              : "未选择文件";
        }
      );

      wrapper.append(
        button,
        fileName
      );

      input.insertAdjacentElement(
        "afterend",
        wrapper
      );
    });
  }

  // 处理个人资料编辑页的隐私提示。
  function translateProfilePrivacyNotice() {
    if (
      !/^\/users\/[^/]+\/profile\/edit\/?$/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main p.notice"
    ).forEach(notice => {
      if (notice.hasAttribute(MARK)) return;

      const privacyLink = Array
        .from(notice.querySelectorAll("a"))
        .find(link =>
          /\/privacy\/?(?:\?|#|$)/.test(
            link.getAttribute("href") || ""
          )
        );

      if (!privacyLink) return;

      const fullText =
        normalizeText(
          notice.textContent ||
          ""
        );

      if (
        !/accessible by the general public/i.test(fullText)
      ) {
        return;
      }

      privacyLink.textContent =
        "隐私政策";

      notice.textContent = "";

      notice.appendChild(
        document.createTextNode(
          "你在 AO3 公开个人资料中发布的任何个人信息，包括但不限于姓名、邮箱地址、" +
          "年龄、所在地、人际关系、性别或性向认同、种族或族裔背景、宗教或政治观点，" +
          "以及你在其他网站使用的账号用户名，都将向公众公开。" +
          "若要了解你使用 AO3 时网站会收集哪些数据以及如何使用这些数据，请参阅我们的"
        )
      );

      notice.appendChild(
        privacyLink
      );

      notice.appendChild(
        document.createTextNode("。")
      );

      notice.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理发布页的内容政策 / 服务条款 FAQ 提示。
  function translateWorkPolicyNotice() {
    if (
      !/^\/works(?:\/|$)/.test(
        location.pathname
      )
    ) {
      return;
    }

    document.querySelectorAll(
      "#main p.notice"
    ).forEach(notice => {
      if (notice.hasAttribute(MARK)) return;

      const links =
        Array.from(
          notice.querySelectorAll("a")
        );

      const contentPolicyLink =
        links.find(
          link =>
            link.getAttribute("href") ===
            "/content"
        );

      const tosFaqLink =
        links.find(
          link =>
            (
              link.getAttribute("href") ||
              ""
            ).includes("/tos_faq")
        );

      if (
        !contentPolicyLink ||
        !tosFaqLink
      ) {
        return;
      }

      contentPolicyLink.textContent =
        "内容政策";

      tosFaqLink.textContent =
        "服务条款 FAQ";

      notice.textContent = "";

      notice.appendChild(
        document.createTextNode(
          "所有在 AO3 上发布的作品都必须遵守我们的"
        )
      );

      notice.appendChild(
        contentPolicyLink
      );

      notice.appendChild(
        document.createTextNode(
          "。更多信息请参阅"
        )
      );

      notice.appendChild(
        tosFaqLink
      );

      notice.appendChild(
        document.createTextNode("。")
      );

      notice.setAttribute(
        MARK,
        "1"
      );
    });
  }

  // 处理 Dashboard 首页“尚未发布内容”的提示。
  function translateEmptyUserHomeMessage() {
    document.querySelectorAll(
      "#main p.alt.message"
    ).forEach(message => {
      if (message.hasAttribute(MARK)) return;

      const fullText =
        normalizeText(
          message.textContent ||
          ""
        );

      if (
        !/^You don't have anything posted under this name yet\. Would you like to post a new work or maybe a new bookmark\s*\?$/i.test(fullText)
      ) {
        return;
      }

      const workLink = Array
        .from(message.querySelectorAll("a"))
        .find(
          link =>
            link.getAttribute("href") ===
              "/works/new" ||
            normalizeText(
              link.textContent
            ) === "post a new work"
        );

      const bookmarkLink = Array
        .from(message.querySelectorAll("a"))
        .find(
          link =>
            link.getAttribute("href") ===
              "/external_works/new" ||
            normalizeText(
              link.textContent
            ) === "new bookmark"
        );

      if (
        !workLink ||
        !bookmarkLink
      ) {
        return;
      }

      workLink.textContent =
        "发布新作品";

      bookmarkLink.textContent =
        "新增书签";

      message.textContent = "";

      message.appendChild(
        document.createTextNode(
          "这个用户名下还没有发布任何内容。要不要"
        )
      );

      message.appendChild(
        workLink
      );

      message.appendChild(
        document.createTextNode(
          "，或者"
        )
      );

      message.appendChild(
        bookmarkLink
      );

      message.appendChild(
        document.createTextNode("？")
      );

      message.setAttribute(
        MARK,
        "1"
      );
    });
  }

  function translateDashboardUI() {
    if (
      !/^\/users\/[^/]+(?:\/.*)?$/.test(
        location.pathname
      )
    ) {
      return;
    }

    const roots =
      document.querySelectorAll(
        "#dashboard, " +
        "#main.users-show.dashboard, " +
        "#main.users-show, " +
        "#main"
      );

    if (!roots.length) return;

    roots.forEach(root => {
      root.querySelectorAll(
        "h1, h2, h3, h4, a, button, " +
        "label, legend, p, span, th, td, input"
      ).forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (shouldSkipElement(el)) return;

        if (isHintOnlyControl(el)) {
          upsertControlHint(el);
          return;
        }

        const text =
          el.textContent ||
          "";

        const translated =
          translateTextValue(text);

        replaceSubmitInput(el);

        if (
          translated !== text &&
          !el.matches("input")
        ) {
          safeSetText(
            el,
            translated.trim()
          );
        }

        const title =
          el.getAttribute("title");

        if (title) {
          const translatedTitle =
            translateTextValue(title);

          if (
            translatedTitle !== title
          ) {
            el.setAttribute(
              "title",
              translatedTitle
            );
          }
        }

        el.setAttribute(
          MARK,
          "1"
        );
      });
    });
  }

  function translateFirstLoginBanner() {
    const banner =
      document.querySelector(
        "#first-login-help-banner"
      );

    if (!banner) return;

    const walker =
      document.createTreeWalker(
        banner,
        NodeFilter.SHOW_TEXT
      );

    let node;

    while ((node = walker.nextNode())) {
      const original =
        node.nodeValue;

      if (
        !original ||
        !original.trim()
      ) {
        continue;
      }

      let out = original;

      out = out.replace(
        /Hi! It looks like you've just logged in to AO3 for the first time\./g,
        "你好！看起来这是你第一次登录 AO3。"
      );

      out = out.replace(
        /For help getting started on AO3, check out some/g,
        "如果你想快速上手 AO3，可以查看一些"
      );

      out = out.replace(
        /or browse through/g,
        "或浏览"
      );

      out = out.replace(
        /If you need technical support,/g,
        "如果你需要技术支持，"
      );

      out = out.replace(
        /If you experience harassment or have questions about our/g,
        "如果你遭遇骚扰，或对我们的"
      );

      out = out.replace(
        /\(including the/g,
        "（包括"
      );

      out = out.replace(
        /\),/g,
        "），"
      );

      out = out.replace(
        /^(\s*)and(\s*)$/,
        "$1以及$2"
      );

      if (out !== original) {
        node.nodeValue = out;
      }
    }

    // 这里只处理链接、按钮、输入控件和小型 span，
    // 不再重复处理已经由 TreeWalker 翻译过的 p 容器。
    banner.querySelectorAll(
      "a, button, input, span"
    ).forEach(el => {
      if (el.hasAttribute(MARK)) return;

      if (isHintOnlyControl(el)) {
        upsertControlHint(el);
        return;
      }

      const text =
        el.textContent ||
        "";

      const translated =
        translateTextValue(text);

      if (
        translated !== text &&
        !el.matches("input")
      ) {
        safeSetText(
          el,
          translated.trim()
        );
      }

      const title =
        el.getAttribute("title");

      if (title) {
        const translatedTitle =
          translateTextValue(title);

        if (
          translatedTitle !== title
        ) {
          el.setAttribute(
            "title",
            translatedTitle
          );
        }
      }

      el.setAttribute(
        MARK,
        "1"
      );
    });
  }

  function translateDeleteCommentModal() {
    const modals =
      document.querySelectorAll(
        "[id^='delete_comment_placeholder_'], " +
        ".delete-comment-placeholder"
      );

    if (!modals.length) return;

    modals.forEach(modal => {
      modal.querySelectorAll(
        "h3, h4, p, a, button, input, span, li"
      ).forEach(el => {
        if (el.hasAttribute(MARK)) return;
        if (shouldSkipElement(el)) return;

        if (isHintOnlyControl(el)) {
          upsertControlHint(el);
          return;
        }

        const text =
          el.textContent ||
          "";

        const translated =
          translateTextValue(text);

        if (
          translated !== text &&
          !el.matches("input")
        ) {
          safeSetText(
            el,
            translated.trim()
          );
        }

        const title =
          el.getAttribute("title");

        if (title) {
          const translatedTitle =
            translateTextValue(title);

          if (
            translatedTitle !== title
          ) {
            el.setAttribute(
              "title",
              translatedTitle
            );
          }
        }

        el.setAttribute(
          MARK,
          "1"
        );
      });

      const walker =
        document.createTreeWalker(
          modal,
          NodeFilter.SHOW_TEXT
        );

      let node;

      while ((node = walker.nextNode())) {
        if (
          node.nodeValue.includes(
            "Are you sure you want to delete this comment?"
          )
        ) {
          node.nodeValue =
            node.nodeValue.replace(
              /Are you sure you want to delete this comment\?/g,
              "你确定要删除这条评论吗？"
            );
        }
      }
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
        response => {
          const error =
            chrome.runtime.lastError;

          if (error) {
            reject(error);
            return;
          }

          if (!response?.ok) {
            reject(
              new Error(
                response?.error ||
                "Translate failed"
              )
            );

            return;
          }

          resolve(
            response.data ||
            ""
          );
        }
      );
    });
  }

  function isPolicyTranslationPage() {
    return /^\/(?:tos|content|privacy)\/?$/.test(
      location.pathname
    );
  }


  // ---------- 政策页（tos / content / privacy）翻译 ----------
  // 原来对每个块单独串行请求（一页上百次），而且 li 和里面的 p
  // 会各翻译一遍。现在：
  //   1. 只翻译「最内层」的块；带嵌套列表的 li 只翻译它自己的那句话；
  //   2. 把相邻的块合并成每次约 1500 字的批量请求，按换行拆回各块。
  const POLICY_TL_CLASS = "ao3-google-policy-translation";
  const POLICY_BLOCK_SEL = "h2, h3, h4, h5, h6, p, li, dt, dd, th, td";
  const POLICY_NESTED_SEL = POLICY_BLOCK_SEL + ", ul, ol, dl, table";
  const POLICY_BATCH_MAX = 1500;

  function isPolicyTranslationBlock(el) {
    if (!el) return false;

    return !el.closest(
      "nav, .navigation, .actions, form, " +
      ".ao3-google-translate-controls, " +
      `.${POLICY_TL_CLASS}`
    );
  }

  // 容器元素（如带嵌套列表的 li）自己的文字，不含嵌套的块和已有译文
  function getPolicyOwnText(el) {
    const clone = el.cloneNode(true);

    clone
      .querySelectorAll(
        `${POLICY_NESTED_SEL}, .${POLICY_TL_CLASS}`
      )
      .forEach(n => n.remove());

    return normalizeText(clone.textContent || "");
  }

  function asPolicyBox(node) {
    return node &&
      node.classList &&
      node.classList.contains(POLICY_TL_CLASS)
      ? node
      : null;
  }

  function collectPolicyItems(main) {
    const items = [];

    main
      .querySelectorAll(POLICY_BLOCK_SEL)
      .forEach(el => {
        if (!isPolicyTranslationBlock(el)) return;

        const nested = el.querySelector(POLICY_NESTED_SEL);
        const appendMode = el.matches("li, dt, dd, th, td");

        // 最内层的块：整块翻译
        if (!nested) {
          const text = normalizeText(
            el.innerText || el.textContent || ""
          );

          if (!text) return;

          items.push({
            text,
            place: box =>
              appendMode
                ? el.appendChild(box)
                : el.insertAdjacentElement("afterend", box),
            find: () =>
              appendMode
                ? el.querySelector(`:scope > .${POLICY_TL_CLASS}`)
                : asPolicyBox(el.nextElementSibling)
          });

          return;
        }

        // 容器：只翻译它自己的文字，译文放在第一个嵌套块之前
        const own = getPolicyOwnText(el);

        if (!own) return;

        items.push({
          text: own,
          place: box =>
            nested.insertAdjacentElement("beforebegin", box),
          find: () => asPolicyBox(nested.previousElementSibling)
        });
      });

    return items;
  }

  // 把相邻的块合并成每组不超过 POLICY_BATCH_MAX 字；超长的块单独一组
  function groupPolicyItems(items, max = POLICY_BATCH_MAX) {
    const groups = [];
    let cur = null;

    for (const item of items) {
      if (item.text.length > max) {
        groups.push({ items: [item], len: item.text.length });
        cur = null;
        continue;
      }

      if (cur && cur.len + 1 + item.text.length <= max) {
        cur.items.push(item);
        cur.len += 1 + item.text.length;
      } else {
        cur = { items: [item], len: item.text.length };
        groups.push(cur);
      }
    }

    return groups;
  }

  // 批量翻译多个单行文本，返回与输入等长的结果数组
  // （每项形如 {text, failed, total, lastError}）。
  // 用换行拼接、按换行拆回；数量对不上就对半拆开重试，
  // 拆到单个时走 translateLong，保证不会错位。
  async function translateBlocksBatch(texts) {
    if (texts.length === 1) {
      return [await translateLong(texts[0])];
    }

    let raw = "";
    let lastError = "";

    for (let attempt = 0; attempt < 2 && !raw; attempt++) {
      try {
        raw = await sendTranslateRequest(texts.join("\n"));

        if (!raw) lastError = "接口返回空结果";
      } catch (error) {
        raw = "";
        lastError = String(error.message || error);
      }
    }

    // 请求本身失败：不再拆分（避免出错时反而发更多请求）
    if (!raw) {
      return texts.map(() => ({
        text: "",
        failed: 1,
        total: 1,
        lastError
      }));
    }

    const parts = raw
      .split("\n")
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length === texts.length) {
      return parts.map(text => ({
        text,
        failed: 0,
        total: 1,
        lastError: ""
      }));
    }

    const mid = Math.ceil(texts.length / 2);
    const left = await translateBlocksBatch(texts.slice(0, mid));
    const right = await translateBlocksBatch(texts.slice(mid));

    return left.concat(right);
  }

  async function translatePolicyPage(
    main,
    button
  ) {
    if (!main) return;

    // 已有成功译文的跳过；上次失败的删掉重翻
    const items = collectPolicyItems(main).filter(item => {
      const box = item.find();

      if (box && box.dataset.failed === "1") {
        box.remove();
        return true;
      }

      return !box;
    });

    if (!items.length) {
      button.textContent = "Google已完成本页翻译";
      return;
    }

    button.disabled = true;

    const total = items.length;
    let done = 0;
    let failedCount = 0;

    const setProgress = () => {
      button.textContent = `Google翻译中…（${done}/${total}）`;
    };

    setProgress();

    for (const group of groupPolicyItems(items)) {
      const boxes = group.items.map(item => {
        const box = document.createElement("div");

        box.className = POLICY_TL_CLASS;
        box.setAttribute(MARK, "1");
        box.textContent = "Google翻译中…";

        item.place(box);

        return box;
      });

      const results = await translateBlocksBatch(
        group.items.map(item => item.text)
      );

      results.forEach((r, i) => {
        const box = boxes[i];

        if (r.failed === r.total) {
          box.textContent =
            `（Google翻译失败：${r.lastError || "无翻译结果"}）`;
          box.dataset.failed = "1";
          failedCount++;
        } else {
          box.textContent = r.text;

          if (r.failed) {
            box.dataset.failed = "1";
            failedCount++;
          }
        }
      });

      done += group.items.length;
      setProgress();
    }

    if (failedCount) {
      button.textContent = `Google翻译 ${failedCount} 段失败，请点击重试`;
      button.disabled = false;
    } else {
      button.textContent = "Google已完成本页翻译";
    }
  }


  function insertPolicyGoogleTranslateButton() {
    if (!isPolicyTranslationPage()) {
      return;
    }

    const main =
      document.querySelector("#main");

    if (!main) return;

    if (
      main.querySelector(
        ".ao3-google-translate-controls"
      )
   ) {
     return;
    }

    const controls =
      document.createElement("div");

   controls.className =
      "ao3-google-translate-controls";

    controls.setAttribute(
      MARK,
      "1"
    );

    const button =
     document.createElement("button");

    button.type = "button";
    button.className =
      BTN_CLASS;

    button.textContent =
     "Google翻译本页";

    button.setAttribute(
      MARK,
      "1"
    );

    const note =
      document.createElement("p");

    note.className =
      "ao3-google-translate-note";

   note.textContent =
      "本页中文由 Google 翻译自动生成，仅供参考；如有歧义，请以 AO3 英文原文为准。";

    note.setAttribute(
      MARK,
      "1"
    );

    controls.appendChild(
      button
   );

    controls.appendChild(
      note
    );

    const heading =
      main.querySelector(
        "h1, h2.heading, h2"
      );

   if (heading) {
      heading.insertAdjacentElement(
        "afterend",
        controls
      );
    } else {
      main.prepend(
       controls
     );
    }

   button.addEventListener(
     "click",
     () => {
       translatePolicyPage(
         main,
         button
       );
     }
   );
  }
  
  // ---------- 长文本分块翻译 ----------
  // 单次请求过长会被翻译接口拒绝或返回空结果，
  // 所以按行/句子切成小块，逐块请求，再按原来的换行拼回去。
  const CHUNK_MAX = 900;

  function getBlockText(el) {
    return (el.innerText || el.textContent || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitIntoChunks(text, max = CHUNK_MAX) {
    const pieces = [];

    text.split("\n").forEach((line, li) => {
      const lead = li === 0 ? "" : "\n";

      if (line.length <= max) {
        pieces.push({ t: line, sep: lead });
        return;
      }

      // 超长的单行（如用 <br> 分隔的整章）按句子再拆
      let first = true;

      for (let s of line.split(
        /(?<=[.!?。！？…]["'”’)]*)\s+/
      )) {
        // 没有标点的超长句硬切
        while (s.length > max) {
          pieces.push({
            t: s.slice(0, max),
            sep: first ? lead : " "
          });
          first = false;
          s = s.slice(max);
        }

        if (s) {
          pieces.push({
            t: s,
            sep: first ? lead : " "
          });
          first = false;
        }
      }
    });

    const chunks = [];
    let cur = null;

    for (const p of pieces) {
      if (
        cur &&
        cur.text.length + p.sep.length + p.t.length <= max
      ) {
        cur.text += p.sep + p.t;
      } else {
        cur = { sep: p.sep, text: p.t };
        chunks.push(cur);
      }
    }

    return chunks;
  }

  async function translateLong(text, onProgress) {
    const chunks = splitIntoChunks(text);
    const out = [];
    let failed = 0;
    let lastError = "";

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];

      if (onProgress) onProgress(i + 1, chunks.length);

      let result = "";

      if (!c.text.trim()) {
        result = c.text;
      } else {
        // 每块最多尝试两次
        for (let attempt = 0; attempt < 2 && !result; attempt++) {
          try {
            result = await sendTranslateRequest(c.text);

            if (!result) lastError = "接口返回空结果";
          } catch (error) {
            result = "";
            lastError = String(error.message || error);
          }
        }

        if (!result) {
          failed++;
          result = "（此段翻译失败）";
        }
      }

      out.push((i === 0 ? "" : c.sep) + result);
    }

    return {
      text: out.join(""),
      failed,
      total: chunks.length,
      lastError
    };
  }

  // 返回 true 表示所有段落都翻译成功
  async function translateParagraphGroup(
    paragraphs
  ) {
    let allOk = true;

    for (const paragraph of paragraphs) {
      const next = paragraph.nextElementSibling;

      if (next && next.classList.contains(TL_CLASS)) {
        // 上次失败的译文框删掉重翻，成功的跳过
        if (next.dataset.failed === "1") {
          next.remove();
        } else {
          continue;
        }
      }

      const text = getBlockText(paragraph);

      if (!normalizeText(text)) continue;

      const box = document.createElement("div");

      box.className = TL_CLASS;
      box.setAttribute(MARK, "1");
      box.textContent = "Google翻译中…";

      paragraph.insertAdjacentElement("afterend", box);

      const r = await translateLong(text, (i, n) => {
        if (n > 1) {
          box.textContent = `Google翻译中…（${i}/${n}）`;
        }
      });

      if (r.failed === r.total) {
        box.textContent =
          `（Google翻译失败：${r.lastError || "无翻译结果"}）`;
        box.dataset.failed = "1";
        allOk = false;
      } else {
        box.textContent = r.text;

        if (r.failed) {
          box.dataset.failed = "1";
          allOk = false;
        }
      }
    }

    return allOk;
  }

  async function translateChapter(
    section,
    button
  ) {
    if (!section) return;

    const paragraphs = [
      ...section.querySelectorAll("p")
    ];

    const bodyLen = paragraphs.reduce(
      (n, p) => n + (p.innerText || "").length,
      0
    );

    button.disabled = true;
    button.textContent = "Google翻译中…";

    // 正常的多段落章节：逐段翻译，译文跟在每段后面。
    // 整章只有 0~2 个 <p>（正文靠 <br> 分隔）时，
    // 逐段插入没有意义，走整章翻译，译文放在章节顶部。
    if (
      paragraphs.length >= 3 ||
      (paragraphs.length > 0 && bodyLen <= 1500)
    ) {
      const ok = await translateParagraphGroup(
        paragraphs
      );

      button.textContent = ok
        ? "Google已完成本章翻译"
        : "Google翻译部分段落失败，请点击重试";
      button.disabled = ok;

      return;
    }

    const existing = section.querySelector(
      ".ao3-full-chapter-translation"
    );

    if (existing) {
      if (existing.dataset.failed !== "1") {
        button.textContent = "Google已完成本章翻译";
        return;
      }

      existing.remove();
    }

    const clone = section.cloneNode(true);

    // 不翻译章节标题、按钮和已有译文。
    clone.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, " +
      "button, " +
      `.${BTN_CLASS}, ` +
      `.${TL_CLASS}`
    ).forEach(el => {
      el.remove();
    });

    // 脱离文档的节点，innerText 等同 textContent，<br> 会丢失，
    // 所以放到屏幕外渲染后再读取（不能用 visibility:hidden，
    // 否则 innerText 会把隐藏文字排除掉）。
    clone.setAttribute("aria-hidden", "true");
    clone.style.cssText =
      "position:fixed;left:-99999px;top:0;" +
      "width:800px;pointer-events:none;";

    document.body.appendChild(clone);

    const text = getBlockText(clone);

    clone.remove();

    if (!text) {
      button.textContent = "未找到可翻译正文";
      button.disabled = false;
      return;
    }

    const box = document.createElement("div");

    box.className =
      `${TL_CLASS} ao3-full-chapter-translation`;
    box.setAttribute(MARK, "1");
    box.textContent = "Google翻译中…";

    if (section.contains(button)) {
      button.insertAdjacentElement("afterend", box);
    } else {
      section.insertBefore(box, section.firstChild);
    }

    const r = await translateLong(text, (i, n) => {
      const msg = `Google翻译中…（${i}/${n}）`;

      box.textContent = msg;
      button.textContent = msg;
    });

    if (r.failed === r.total) {
      box.textContent =
        `（Google翻译失败：${r.lastError || "无翻译结果"}）`;
      box.dataset.failed = "1";
      button.textContent = "Google翻译失败，请点击重试";
      button.disabled = false;
      return;
    }

    box.textContent = r.text;

    if (r.failed) {
      box.dataset.failed = "1";
      button.textContent =
        `Google翻译 ${r.failed}/${r.total} 段失败，请点击重试`;
      button.disabled = false;
      return;
    }

    button.textContent = "Google已完成本章翻译";
  }

  async function translateNotes(
    section,
    button
  ) {
    if (!section) return;

    const label =
      section.matches(".summary")
        ? "简介"
        : "备注";

    const quote =
      section.querySelector(
        "blockquote.userstuff"
      );

    if (!quote) return;

    const paragraphs = [
      ...quote.querySelectorAll("p")
    ];

    button.disabled = true;
    button.textContent = "Google翻译中…";

    // 没有 <p>（只用 <br> 或纯文本）时，把整块 blockquote 当作一段翻译。
    const ok = await translateParagraphGroup(
      paragraphs.length
        ? paragraphs
        : [quote]
    );

    button.textContent = ok
      ? `Google已完成${label}翻译`
      : "Google翻译失败，请点击重试";

    button.disabled = ok;
  }

  function insertTranslateButtons() {
    const sections =
      document.querySelectorAll(
        ".chapter .userstuff.module[role='article'], " +
        "#chapters > .userstuff"
      );

    sections.forEach(section => {
      const heading =
        section.querySelector(
          "h3#work, h3.landmark.heading"
        ) ||
        document.querySelector(
          "#chapters > h3#work, " +
          "#chapters > h3.landmark.heading"
        );

      if (!heading) return;

      if (
        heading.nextElementSibling &&
        heading.nextElementSibling.classList.contains(
          BTN_CLASS
        )
      ) {
        return;
      }

      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        BTN_CLASS;

      button.textContent =
        "Google翻译本章";

      button.addEventListener(
        "click",
        () => translateChapter(
          section,
          button
        )
      );

      heading.insertAdjacentElement(
        "afterend",
        button
      );
    });

    const noteModules =
      document.querySelectorAll(
        ".notes.module, " +
        ".summary.module"
      );

    noteModules.forEach(section => {
      if (
        section.querySelector(
          `.${NOTES_BTN_CLASS}`
        )
      ) {
        return;
      }

      const heading =
        section.querySelector(
          "h3.heading"
        );

      const quote =
        section.querySelector(
          "blockquote.userstuff"
        );

      if (!heading || !quote) return;

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        NOTES_BTN_CLASS;

      button.textContent =
        section.matches(".summary")
          ? "Google翻译简介"
          : "Google翻译备注";

      button.addEventListener(
        "click",
        () => translateNotes(
          section,
          button
        )
      );

      heading.insertAdjacentElement(
        "afterend",
        button
      );
    });
  }

  // AO3 自动补全组件的三句提示语（开始输入 / 无结果 / 搜索中）存放在输入框的
  // data-autocomplete-*-text 属性里，由 AO3 的脚本在下拉框里显示。
  // 直接把属性值换成中文，AO3 自己写入下拉框的就是中文，不依赖观察时机。
  // 不检查 MARK：这些输入框往往已被标记过，但属性值还是英文。
  const AUTOCOMPLETE_TEXT_ATTRS = [
    "data-autocomplete-hint-text",
    "data-autocomplete-no-results-text",
    "data-autocomplete-searching-text"
  ];

  function translateAutocompleteAttributes(root = document) {
    root
      .querySelectorAll(
        AUTOCOMPLETE_TEXT_ATTRS
          .map(a => `input[${a}]`)
          .join(", ")
      )
      .forEach(input => {
        for (const attr of AUTOCOMPLETE_TEXT_ATTRS) {
          const value = input.getAttribute(attr);

          if (!value) continue;

          const translated = translateTextValue(value);

          if (translated !== value) {
            input.setAttribute(attr, translated);
          }
        }
      });
  }

  function runAll() {
    injectStyles();

    translateAutocompleteAttributes();

    applyControlHints(
      document.body
    );

    translateFlashMessages(
      document.body
    );

    // 混合文字与链接的专门处理必须先于通用翻译。
    translateTosPromptAgreementNotice();
    translateWorkPolicyNotice();
    translateProfilePrivacyNotice();
    translatePseudUsernameNotice();
    translateBlockedUsersNotice();
    translateUnblockUserNotice();
    translateMuteUserNotice();
    translateUnmuteUserNotice();
    translateMutedUsersNotice();
    translateInviteRequestIntroNotice();
    translateInviteRequestStatusNotice();
  

    // 笔名页面专用处理。
    translatePseudActionLinks();
    localizePseudFileInput();

    translateEmptyUserHomeMessage();

    translateTextNodes(
      document.body
    );

    translateInputs(
      document.body
    );

    translateMetaSection();
    translateWorksNew();
    translateWorksSearch();
    translateSubscriptionsPage();
    translateCommentUI();
    forceTranslateCommentActionLinks();
    translateDashboardUI();
    translateFirstLoginBanner();
    translateDeleteCommentModal();

    insertPolicyGoogleTranslateButton();
    insertTranslateButtons();
  }

  // 动态更新的单个文本节点（AO3 脚本用 .text()/.html() 写入的提示语等）。
  // 与 translateTextNodes 的区别：不因父元素已有 MARK 而跳过——
  // 父元素可能是之前翻译过、后来被脚本改回英文的。
  // lastSet 用来避免自己写入 nodeValue 后又被观察到而重复处理。
  const lastSet = new WeakMap();

  function translateOneTextNode(node) {
    const parent = node.parentElement;

    if (!parent) return;
    if (parent.closest("head")) return;
    if (parent.closest(`.${POLICY_TL_CLASS}`)) return;
    if (lastSet.get(node) === node.nodeValue) return;
    if (shouldSkipElement(parent)) return;

    const control = parent.closest(
      "button, a.button, .actions a"
    );

    if (control && isHintOnlyControl(control)) return;

    const original = node.nodeValue;

    if (!normalizeText(original)) return;

    const translated = translateTextValue(original);

    if (translated !== original) {
      node.nodeValue = translated;
      lastSet.set(node, translated);
    }
  }

  function setupObserver() {
    let timer = null;

    const observer =
      new MutationObserver(
        mutations => {
          let hasNewElements = false;

          for (const mutation of mutations) {
            // 已有文本节点的内容被改写
            if (mutation.type === "characterData") {
              translateOneTextNode(mutation.target);
              continue;
            }

            for (
              const node of mutation.addedNodes
            ) {
              // 新增的纯文本节点：直接翻译，不必整页重跑
              if (node.nodeType === Node.TEXT_NODE) {
                translateOneTextNode(node);
                continue;
              }

              if (
                node.nodeType ===
                  Node.ELEMENT_NODE &&
                !node.hasAttribute(MARK)
              ) {
                hasNewElements = true;
              }
            }
          }

          if (!hasNewElements) return;

          clearTimeout(timer);

          timer = setTimeout(
            () => {
              runAll();
            },
            180
          );
        }
      );

    observer.observe(
      document.documentElement,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );
  }

  chrome.storage.sync.get(
    {
      ao3ZhEnabled: true
    },
    settings => {
      if (!settings.ao3ZhEnabled) {
        return;
      }

      runAll();
      setupObserver();
    }
  );
})();