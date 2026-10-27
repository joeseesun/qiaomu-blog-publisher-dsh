# 乔木博客发布 · DeepSeek Harness

[English](README.en.md)

把 Markdown 笔记发布到自己的 Qiaomu Blog。直接使用原 Obsidian 插件的发布弹窗、分类与设置页，保留本地图片、音频、视频和远程图片转存流程。

![原版发布窗口](docs/screenshots/original-publish.png)

## 功能

- 标题自动从 frontmatter、一级标题、文件名依次提取，可在原发布窗口修改。
- 获取博客分类，选择草稿或直接发布；显示上传进度、成功数量、失败原因和重试入口。
- 标准 Markdown 图片与 Wiki 嵌入，自动上传本地图片/音频/视频到博客 R2，转存第三方图片并改写链接。
- Markdown 工作目录、文件导入、草稿恢复、保存冲突保护与外部修改同步。
- 原版连接设置、API Token 测试；Token 存入系统安全凭据库。

## 安装

要求 DeepSeek Harness `0.2.1-rc.3`（`<0.3.0`），Node.js 22 或更新。

从 [Releases](https://github.com/joeseesun/qiaomu-blog-publisher-dsh/releases) 下载 tgz 和 SHA256SUMS，校验后在插件管理安装，或运行：

```sh
dsh plugin --profile desktop add /absolute/path/qiaomu-blog-publisher-dsh-0.1.0.tgz
```

侧栏打开「乔木博客发布」，导入 Markdown，在设置里填写自己的博客地址和 API Token，点击「发布到博客」。默认创建草稿；选择「直接发布」会公开文章。

## 数据与旧配置

默认笔记目录为 `$DSH_HOME/qiaomu/qiaomu-blog-publisher-dsh/notes`，未设置 DSH_HOME 时为 `~/.dsh`。可用插件配置 `notesDir` 指向明确选择的笔记目录，`dataDir` 指定插件状态目录，均使用绝对路径。单篇 Markdown 上限 2 MB，附件上限 32 MB，不跟随工作目录内软链接。

「导入」支持 Markdown、媒体和原博客插件 `data.json`。媒体放在 `attachments`，Markdown 中保持相应路径；完整目录可直接配置为 notesDir。导入旧配置会把 Token 迁入 macOS Keychain、Windows DPAPI 或 Linux Secret Service，新的状态 JSON 不保存 Token，原配置不会删除。Linux 需要 `secret-tool` 和 Secret Service。

博客须支持原 [Qiaomu Blog](https://github.com/joeseesun/qiaomu-blog-opensource) API。媒体上传失败时沿用原版行为：文章可以创建并报告失败数量，请检查文章中的媒体链接。

## 验证边界

测试覆盖原发布业务、分类、图片/音频/视频 multipart、远程图片、标题、失败响应、CAS 保存、路径与网络边界；UI 在独立 Harness profile 验收。测试内容只发送给本机 fixture，没有提交到真实博客或 R2。Windows/Linux 凭据没有对应系统实机验收。详见 [迁移记录](docs/ADAPTATION.md)。

```sh
npm ci
npm run check
npm pack
```

MIT。原版冻结来源 `5d41358f707320c2f56016bf62327eb60d8668b8`，来源及打包依赖见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
