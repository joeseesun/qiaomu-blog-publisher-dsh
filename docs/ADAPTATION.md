# 原版博客发布迁移

来源：`joeseesun/qiaomu-blog-opensource` 的 `ecosystem/obsidian-publisher`，冻结提交 `5d41358f707320c2f56016bf62327eb60d8668b8`，版本 1.0.0，MIT。原仓库工作区保持不变。

用户要求完整功能迁移、最大程度复用原 UI。原插件只有发布弹窗和设置页，没有独立编辑器；本版本直接使用这两个组件与弹窗内嵌 CSS，Markdown 编辑、文件选择和保存由必要的 Harness 宿主边界承接。

| 原版能力 | 迁移实现与验证 |
| --- | --- |
| 发布标题、分类、草稿/直接发布选项 | 原 PublishModal 直接使用；默认草稿。原进度、成功、失败重试、编辑与查看入口保留。真实本机 HTTP fixture 验证分类、请求状态、标题及返回 slug。 |
| 标题优先级 | frontmatter > H1 > 文件名；测试包含 CRLF frontmatter。 |
| 本地图片/音频/视频 | 原媒体类型和 MIME 映射保留，工作目录内相对路径/Wiki 嵌入经 Host 读取。真实 socket fixture 检查 multipart 图片、audio/mpeg 和 video/mp4。重复资源复用上传结果、不同 alt 引用均替换。 |
| 远程图片转存 | 原下载与 /api/uploads 路径保留，随后改写正文链接。fixture 验证下载不携带博客 Token。 |
| 博客 API | /api/admin/categories、/api/uploads、/api/posts 沿用原契约；没有用公众号 API 代替。真实博客/R2 账号未调用。 |
| API 设置与迁移 | 原设置页；导入原 data.json。Token 移入 macOS Keychain/Windows DPAPI/Linux Secret Service，配置只存 apiUrl。系统凭据服务和目录与其他插件隔离。 |
| 命令和上下文入口 | Harness 侧栏、原生快捷操作、编辑器右键、状态栏入口；文件通过 Markdown 选择框切换。 |
| 本地数据 | 显式 notesDir，文件名/正文草稿恢复、CAS 保存、外部修改同步；异步写入期间继续编辑保留未保存状态。2 MB 笔记、32 MB 附件；不读写未选原 Obsidian 数据。 |
| 生命周期 | 插件自有 DOM 增强，无全局原型修改；卸载销毁编辑器、监听、定时器、弹窗和原内嵌样式。 |

测试只提交到独立本机 fixture，不代表真实博客/R2 账号验收。macOS 为当前测试系统；Windows/Linux 凭据仅实现，未实机验收。发布和日常安装状态后续追加。

## 2026-10-27 22:28 真实 Harness fixture 验收

独立 ports-qa profile 实际安装候选包，通过原「导入」入口导入旧配置、PNG、MP3、MP4 和 Markdown。原发布窗口自动提取 frontmatter 标题并加载「迁移验收」分类；选择草稿后提交到 127.0.0.1:4385 测试服务。

实际 HTTP 记录：3 次媒体 POST（138937 / 59834 / 1212754 字节）及一次 /api/posts（304 字节）；正文三处链接均改写，status=draft、category=迁移验收。原成功窗口显示「3 个文件上传成功」。截图 original-publish.png / original-success-fixture.png。该证据只证明真实 Harness 到测试 API 的链路，不代表远端博客/R2 生产验收。

11 项测试、构建与包契约通过。原 UI 内嵌样式保留；宿主 Setting 的 CTA 按钮映射到 Harness 品牌色，不重画表单。

22:30 补充：原设置「测试」按钮返回连接成功、1 个分类；720px 发布表单宽 520px、页面无横向溢出。r3 移除宿主额外设置标题，保留原设置页自己的标题。仍只用本机 fixture，未使用生产凭据。
