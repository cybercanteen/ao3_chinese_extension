# AO3中文助手

AO3中文助手是一个Chrome浏览器扩展，用于改善简体中文用户在Archive of Our Own（AO3）上的使用体验。

插件会将AO3的常见界面翻译为简体中文，并为作品正文、简介、作者备注及部分政策页面提供Google翻译按钮。

## 功能

- 将 AO3 常见用户界面翻译为简体中文
- 目前已经汉化：作品发布、章节发布、搜索、订阅、个人设置、用户静音、屏蔽及相关确认页面等常用页面
- 提供Google翻译按钮，用于翻译作品正文、简介与作者备注；支持长章节分段翻译、失败提示与重试
- 支持部分AO3政策页面的Google翻译，并保留英文原文供对照
- 改进动态字符计数、自动补全提示等动态界面的中文显示
- 保护作品标题、作者名、自定义标签等用户生成内容，减少误翻译

常见界面汉化由插件内置词典直接在浏览器中完成，不需要使用机器翻译服务。

## 支持网站

https://archiveofourown.org

## 安装方式

### Chrome Web Store

AO3 中文助手已在 Chrome Web Store 发布，可直接从商店安装。

### 手动安装

1. 下载或克隆本仓库
2. 打开 Chrome 扩展程序页面：

   `chrome://extensions`

3. 开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择插件文件夹

## 翻译方式

AO3中文助手包含两种不同的翻译方式：

### 界面汉化

AO3常见界面由插件内置的中文词典直接在浏览器中进行替换。

这部分功能不需要将AO3页面文本发送给插件开发者或机器翻译服务。

### Google翻译

当用户主动点击Google翻译按钮时，需要翻译的作品正文、简介、作者备注或政策文本会发送至Google Translate服务，用于生成译文。

机器翻译结果会作为额外的中文译文显示，插件不会修改AO3上原有的作品正文。

## 隐私与数据

- 本插件为开源项目，源代码可公开查看
- 插件开发者不会通过本插件收集、存储或出售用户的个人数据
- 本插件没有自建服务器用于保存 AO3 页面内容或机器翻译文本
- 常见界面汉化在浏览器本地完成
- 只有当用户主动使用Google翻译功能时，相关待翻译文本才会发送至Google Translate服务

## 第三方服务

本插件使用Google Translate提供机器翻译功能。

当用户主动请求翻译时，相关文本可能会发送至Google的翻译服务。

Google隐私政策：

https://policies.google.com/privacy

## 开源与反馈

源代码：

https://github.com/cybercanteen/ao3_chinese_extension

欢迎通过GitHub Issues提交问题、建议或翻译修正。

也欢迎提交Pull Request帮助改进插件。

## 项目性质

本项目是一个非商业性的社区工具。

本项目与Organization for Transformative Works（OTW）及 Archive of Our Own（AO3）无隶属或官方关联。

## License

MIT License
