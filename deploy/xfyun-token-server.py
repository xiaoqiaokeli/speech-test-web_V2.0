#!/usr/bin/env python3
# 讯飞语音听写(IAT)鉴权 URL 签发服务
# 逻辑等同 functions/api/xfyun-token.js (Cloudflare Pages Function)
# 零依赖(仅标准库)。监听 127.0.0.1:8787，由 Nginx 反代 /api/xfyun-token。
import base64
import hashlib
import hmac
import json
import os
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import quote, urlparse

XFYUN_HOST = "iat-api.xfyun.cn"
XFYUN_PATH = "/v2/iat"
PORT = int(os.environ.get("PORT", "8787"))
BIND = os.environ.get("BIND", "127.0.0.1")


def build_token_response():
    app_id = os.environ.get("XFYUN_APP_ID")
    api_key = os.environ.get("XFYUN_API_KEY")
    api_secret = os.environ.get("XFYUN_API_SECRET")

    if not app_id or not api_key or not api_secret:
        return 500, {"error": "XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET 未配置"}

    date = formatdate(usegmt=True)  # RFC 1123, 等同 JS toUTCString()
    signature_origin = "host: {}\ndate: {}\nGET {} HTTP/1.1".format(XFYUN_HOST, date, XFYUN_PATH)
    signature = base64.b64encode(
        hmac.new(api_secret.encode("utf-8"), signature_origin.encode("utf-8"), hashlib.sha256).digest()
    ).decode("ascii")
    authorization_origin = (
        'api_key="{}", algorithm="hmac-sha256", headers="host date request-line", signature="{}"'.format(
            api_key, signature
        )
    )
    authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("ascii")
    url = "wss://{host}{path}?authorization={auth}&date={date}&host={host}".format(
        host=XFYUN_HOST,
        path=XFYUN_PATH,
        auth=quote(authorization, safe=""),
        date=quote(date, safe=""),
    )
    return 200, {"url": url, "appId": app_id}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/api/xfyun-token", "/"):
            status, body = build_token_response()
        else:
            status, body = 404, {"error": "not found"}
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        pass  # 保持日志安静，避免 journal 噪音


class ThreadingServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    server = ThreadingServer((BIND, PORT), Handler)
    print("xfyun token server listening on http://{}:{}".format(BIND, PORT), flush=True)
    server.serve_forever()
