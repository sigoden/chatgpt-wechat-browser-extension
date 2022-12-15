# ChatGPT 微信文件助手机器人

> [English](README.md) | 中文文档

将微信文件助手转换为 chatgpt 驱动的聊天机器人的浏览器扩展，支持 Chrome/Edge/Firefox

![截图](https://user-images.githubusercontent.com/4012553/207370847-037177e5-2986-4562-9df5-b345d893704c.png)

## 用法

1. 访问【微信文件助手】(https://szfilehelper.weixin.qq.com)。
2. 通过手机和网站发送聊天信息，ChatGPT 会自动回复。

> 建议使用扩展 [ChatGPT Keep Alive](https://github.com/sigoden/chatgpt-keep-alive-browser-extension) 来保持 [ChatGPT](https://chat.openai.com/ 聊天）活着。

## 安装

### 安装到 Chrome/Edge

#### 从 Chrome 网上应用店安装（首选）

<https://chrome.google.com/webstore/detail/chatgpt-for-wechat-filehe/ilmojomofhhilbkgmealhonmhfncebmg>

#### 本地安装

1. 从 [Releases](https://github.com/sigoden/chatgpt-wechat-browser-extension/releases) 下载 `chromium.zip`。
2. 解压缩文件。
3. 在 Chrome/Edge 中转到扩展页面（`chrome://extensions` 或 `edge://extensions`）。
4. 启用开发者模式。
5. 将解压后的文件夹拖到页面任意位置导入（之后不要删除文件夹）。

### 安装到 Firefox

#### 本地安装

1. 从 [Releases](https://github.com/sigoden/chatgpt-wechat-browser-extension/releases) 下载 `firefox.zip`。
2. 解压缩文件。
3. 转到`about:debugging`，点击边栏上的“This Firefox”。
4. 点击“Load Temporary Add-on”按钮，然后选择解压文件夹中的任意文件。

## 从源代码构建

1. 克隆回购
2. 使用`npm`安装依赖
3. `npm 运行构建` 4. 将 `build/chromium/` 或 `build/firefox/` 目录加载到您的浏览器

# 贡献

欢迎贡献你的代码和想法 🍵。
