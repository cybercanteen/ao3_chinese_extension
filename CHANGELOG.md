# Changelog

## 1.1.2

- 增加静音与屏蔽页面汉化：补充用户静音、屏蔽、解除静音与解除屏蔽等相关页面及提示文字的中文翻译。
Expanded mute and block page localization: Added Simplified Chinese translations for mute, block, unmute, unblock, and related notices and confirmation pages.
- 为 AO3 政策页面添加 Google 翻译：在部分用户政策页面提供 Google 翻译按钮，同时保留英文原文供对照。
Added Google Translate support for AO3 policy pages: Selected policy pages can now be translated with Google Translate while keeping the original English text visible for reference.
- 改进章节、简介与备注翻译：修复部分使用 `<br>` 或其他特殊排版的作品点击翻译后无法正常显示译文的问题，并提升简介与作者备注的翻译兼容性。
Improved chapter, summary, and notes translation: Fixed cases where translations were not displayed correctly for works using <br> or other non-standard formatting, and improved translation compatibility for summaries and author notes.
- 支持长章节分段翻译与失败重试：较长的章节会自动分段处理，并在部分或全部翻译失败时提供明确提示和重试选项。
Added chunked translation and retry support for long chapters: Long chapters are now automatically split into smaller sections for translation, with clearer failure messages and retry options.
- 完善作品与章节发布页面汉化：补充作品标题、作者/笔名、共同创作者、标题错误提示、富文本编辑提示等发布界面内容。
Expanded localization for work and chapter posting pages: Added translations for work titles, creator/pseud fields, co-creators, title validation messages, rich-text editor notices, and other posting interface elements.
- 改进动态界面内容汉化：完善动态字符计数、自动补全提示、搜索状态及无结果提示等内容的中文显示。
Improved localization of dynamic interface content: Added better handling for live character counters, autocomplete hints, searching states, and no-result messages.
- 提高复杂页面的汉化兼容性：改进包含粗体、链接等复杂 HTML 结构的文字处理，并进一步保护作品标题、作者名和自定义标签等用户内容，减少误翻译。
Improved localization compatibility on complex pages: Improved handling of text containing formatting and links, while better protecting user-generated content such as work titles, creator names, and custom tags from accidental translation.
- 进一步明确区分插件内置界面汉化与 Google 机器翻译功能。
This release also makes the distinction between built-in interface localization and Google machine translation clearer throughout the extension.

## 1.1.1

- 完善笔名相关页面的中文翻译，包括新建、编辑、默认笔名、头像设置及相关提示信息。Improved Chinese translations across pseud-related pages, including pseud creation and editing, default pseud labels, icon settings, and related notices.
- 清理遗留代码并优化部分页面专用翻译逻辑。Removed unused legacy code and optimized page-specific translation logic to reduce unnecessary page processing.
- 修复若干界面翻译问题。Fixed several UI translation issues.
  
## 1.1.0

- 优化提交按钮处理方式：在保留AO3原始提交值的同时显示中文按钮文字，以减少对网站功能的影响。Improved submit button handling: Chinese button labels are now shown while preserving AO3’s original submit values, reducing the risk of affecting site functionality.
- 扩充字典：新增作品搜索、筛选、批量编辑、订阅、评论等页面的翻译词条。Expanded the UI dictionary with new entries for work search, filters, batch editing, subscriptions, comments, and related pages.
- 修复若干界面翻译问题。Fixed several UI translation issues.
  
## 1.0.2

- 修复Bug。Bug fix.
- 修订了字典。Add new content to the dictionary.
  
## 1.0.1

- 为该扩展程序添加了启用/禁用开关。Added an enable/disable toggle for the extension.
- 点击该开关后，允许当前AO3界面在翻译文本和原文之间切换。The current page refreshes after the toggle is changed, allowing the AO3 interface to switch between translated and original text.

## 1.0.0

初次发布。Initial release. 

- 汉化 AO3 常见用户界面
- 提供「翻译本章」按钮
- 提供「翻译备注」按钮
- 使用 Google Translate 提供即时翻译
