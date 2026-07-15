# 言语测试网站

这是一个面向微信/手机浏览器使用的言语测试静态网站。

## Cloudflare Pages 设置

- Framework preset: None / Static HTML
- Build command: exit 0
- Build output directory: public
- Root directory: 留空

## 讯飞语音听写环境变量

在 Cloudflare Pages 项目中进入 Settings -> Environment variables，添加：

- XFYUN_APP_ID
- XFYUN_API_KEY
- XFYUN_API_SECRET

这些值来自讯飞开放平台“语音听写 IAT”服务。不要把密钥写进前端，也不要提交到 GitHub。

## 国内部署（UCloud，主入口）

国内用户访问入口：**https://hearing.hnboy2005.info/**（服务器 106.75.246.233）。
Cloudflare Pages（https://speech-test-web.pages.dev/）保留作为海外/备用入口。

服务器架构：

- Nginx 托管静态文件：`/var/www/speech-test`（对应本仓库 `public/`），配置在 `/etc/nginx/conf.d/speech-test.conf`
- 讯飞 token 服务：`/opt/speech-test/xfyun-token-server.py`（Python3 标准库，无依赖），
  systemd 单元 `speech-test-token`，监听 127.0.0.1:8787，由 Nginx 反代 `/api/xfyun-token`
- 讯飞密钥：`/etc/speech-test/env`（权限 600，不在 Git 中）
- HTTPS：Let's Encrypt（certbot），自动续期 cron 位于 `/etc/cron.d/certbot-renew`
- DNS：Cloudflare 上 `hearing` A 记录 → 106.75.246.233，**必须保持 DNS only（灰色云朵）**

更新网站内容：

```bash
bash deploy/deploy.sh
```

更新 token 服务：

```bash
scp deploy/xfyun-token-server.py root@106.75.246.233:/opt/speech-test/
ssh root@106.75.246.233 'systemctl restart speech-test-token'
```

## 环境噪声与声级校准

- 仅在词语音频播放期间循环播放环境噪声；进入录音、识别、判断或结果阶段后立即停止。
- 词语与噪声素材已按 RMS 元数据归一化，数字音频域保持人声比背景高 10 dB（SNR +10 dB）。
- 页面中的背景 50 dB / 人声 60 dB 是目标声压级。浏览器无法控制设备的绝对 dB SPL；正式测试前需用声级计校准指定设备和系统媒体音量，并在测试期间锁定该音量。
