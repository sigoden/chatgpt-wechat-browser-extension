# ChatGPT Wechat

> English | [中文文档](README.zh.md)

A browser extension to turn wechat filehelper into a chatgpt-powered chatbot, supports Chrome/Edge/Firefox

![screenshot](https://user-images.githubusercontent.com/4012553/207370847-037177e5-2986-4562-9df5-b345d893704c.png)

## Usage

1. Visit [Wechat FileHelper](https://szfilehelper.weixin.qq.com).
2. Send chat messages via phones and site, and ChatGPT will automatically reply.

## Installation

### Install to Chrome/Edge

#### Install from Chrome Web Store (Preferred)

<https://chrome.google.com/webstore/detail/chatgpt-for-wechat-filehe/ilmojomofhhilbkgmealhonmhfncebmg>

#### Local Install

1. Download `chromium.zip` from [Releases](https://github.com/sigoden/chatgpt-wechat-browser-extension/releases).
2. Unzip the file.
3. In Chrome/Edge go to the extensions page (`chrome://extensions` or `edge://extensions`).
4. Enable Developer Mode.
5. Drag the unzipped folder anywhere on the page to import it (do not delete the folder afterwards).

### Install to Firefox

#### Local Install

1. Download `firefox.zip` from [Releases](https://github.com/sigoden/chatgpt-wechat-browser-extension/releases).
2. Unzip the file.
3. Go to `about:debugging`, click "This Firefox" on the sidebar.
4. Click "Load Temporary Add-on" button, then select any file in the unzipped folder.

## Build from source

1. Clone the repo
2. Install dependencies with `npm`
3. `npm run build`
4. Load `build/chromium/` or `build/firefox/` directory to your browser

# Contributions

Welcome to contribute your code and ideas🍵.
