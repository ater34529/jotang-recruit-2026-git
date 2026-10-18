#!/usr/bin/env python3
"""demo-AI-web 的本地开发服务器。

职责：
1. 提供 index.html / css / js 静态资源；
2. 把同源的 POST /chat 转发给 demo-AI（默认 http://127.0.0.1:8080）；
3. 提供 GET /__health，供前端判断本地代理和后端是否可用。

只依赖 Python 标准库，无需安装任何第三方包。
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

WEB_ROOT = Path(__file__).resolve().parent
MAX_BODY_BYTES = 2 * 1024 * 1024
# 显式禁用系统代理，避免 localhost 请求被代理软件截走。
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def iso_now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class JotangHandler(SimpleHTTPRequestHandler):
    """静态文件 + /chat 反向代理。"""

    server_version = "JotangWeb/1.0"
    protocol_version = "HTTP/1.1"

    # ---------------- 通用响应 ----------------

    def end_headers(self) -> None:
        # 开发期禁用缓存，改完 JS/CSS 刷新即可看到效果。
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def send_json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def relay(self, status: int, content_type: str, content: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type or "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    # ---------------- 路由 ----------------

    def do_GET(self) -> None:  # noqa: N802
        route = urlsplit(self.path).path
        if route == "/__health":
            self.handle_health()
            return
        if route == "/chat":
            self.send_json(405, {
                "error": "method_not_allowed",
                "message": "对话接口只支持 POST /chat。",
            })
            return
        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        route = urlsplit(self.path).path
        if route == "/__health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        super().do_HEAD()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Allow", "GET, HEAD, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_POST(self) -> None:  # noqa: N802
        route = urlsplit(self.path).path
        if route != "/chat":
            self.send_json(404, {
                "error": "not_found",
                "message": "只有 /chat 支持 POST。",
            })
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            self.send_json(411, {
                "error": "length_required",
                "message": "请求体为空，或缺少 Content-Length。",
            })
            return
        if length > MAX_BODY_BYTES:
            self.send_json(413, {
                "error": "payload_too_large",
                "message": "请求体超过 2 MB。",
            })
            return

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json(400, {
                "error": "invalid_json",
                "message": "请求体不是合法 JSON：%s" % exc,
            })
            return
        if (not isinstance(payload, dict)
                or not isinstance(payload.get("message"), str)
                or not payload["message"].strip()):
            self.send_json(400, {
                "error": "invalid_request",
                "message": "请求体需要包含非空 message 字段。",
            })
            return

        self.proxy_chat(raw)

    # ---------------- 健康检查 ----------------

    def handle_health(self) -> None:
        backend = self.server.backend_url  # type: ignore[attr-defined]
        reachable = False
        detail = ""
        try:
            request = urllib.request.Request(
                backend + "/",
                method="GET",
                headers={"Accept": "application/json", "User-Agent": "JotangWeb/1.0"},
            )
            with OPENER.open(request, timeout=self.server.health_timeout) as response:  # type: ignore[attr-defined]
                response.read(64)
            reachable = True
        except urllib.error.HTTPError:
            # Spring 对未映射路径返回 404/405，能收到 HTTP 响应就说明进程在线。
            reachable = True
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            detail = str(getattr(exc, "reason", exc))

        self.send_json(200, {
            "reachable": reachable,
            "backend": backend,
            "checkedAt": iso_now(),
            "detail": detail,
        })

    # ---------------- 对话转发 ----------------

    def proxy_chat(self, raw: bytes) -> None:
        backend = self.server.backend_url  # type: ignore[attr-defined]
        target = backend + "/chat"
        request = urllib.request.Request(
            target,
            data=raw,
            method="POST",
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Accept": "application/json",
                "User-Agent": "JotangWeb/1.0",
            },
        )

        try:
            with OPENER.open(request, timeout=self.server.proxy_timeout) as response:  # type: ignore[attr-defined]
                content = response.read()
                content_type = response.headers.get("Content-Type", "")
                self.relay(response.status, content_type, content)
        except urllib.error.HTTPError as exc:
            content = exc.read()
            content_type = exc.headers.get("Content-Type", "") if exc.headers else ""
            self.relay(exc.code, content_type, content)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            detail = str(getattr(exc, "reason", exc))
            self.send_json(502, {
                "error": "bad_gateway",
                "message": "本地代理无法连接 demo-AI，请确认后端已在 localhost:8080 启动。",
                "backend": backend,
                "detail": detail,
            })

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("[%s] %s\n" % (time.strftime("%H:%M:%S"), fmt % args))
        sys.stderr.flush()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Jotang AI 笔记助手：静态文件服务器 + demo-AI 反向代理",
    )
    parser.add_argument("--host", default="127.0.0.1", help="监听地址（默认 127.0.0.1）")
    parser.add_argument("--port", type=int, default=8000, help="监听端口（默认 8000）")
    parser.add_argument(
        "--backend",
        default="http://127.0.0.1:8080",
        help="demo-AI 地址（默认 http://127.0.0.1:8080）",
    )
    parser.add_argument("--timeout", type=float, default=300.0, help="转发 /chat 的超时秒数（默认 300）")
    parser.add_argument("--health-timeout", type=float, default=2.5, help="健康检查超时秒数（默认 2.5）")
    parser.add_argument("--open", action="store_true", help="启动后自动打开浏览器")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    backend = args.backend.rstrip("/")
    handler = partial(JotangHandler, directory=str(WEB_ROOT))

    try:
        server = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        print("启动失败：无法监听 %s:%s（%s）" % (args.host, args.port, exc), file=sys.stderr)
        print("可以换一个端口，例如：python server.py --port 8001", file=sys.stderr)
        return 1

    server.backend_url = backend  # type: ignore[attr-defined]
    server.proxy_timeout = args.timeout  # type: ignore[attr-defined]
    server.health_timeout = args.health_timeout  # type: ignore[attr-defined]

    display_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    page_url = "http://%s:%d/" % (display_host, server.server_port)

    print("")
    print("  Jotang AI · 笔记智能助手")
    print("  --------------------------------")
    print("  页面:   %s" % page_url)
    print("  代理:   POST /chat  ->  %s/chat" % backend)
    print("  健康:   GET  /__health")
    print("  停止:   Ctrl + C")
    print("")

    if args.open:
        threading.Timer(0.6, lambda: webbrowser.open(page_url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止本地服务器。")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
