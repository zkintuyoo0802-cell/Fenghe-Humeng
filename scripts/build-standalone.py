#!/usr/bin/env python3
"""生成 index.standalone.html：内联 CSS + data.js + dashboard.js，ZIP 分发后单文件双击即可用。"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
OUT = ROOT / "index.standalone.html"


def escape_for_script(s: str) -> str:
    """避免内联 </script> 截断 HTML（不区分大小写）。"""
    return re.sub(r"</script\s*>", r"<\\/script>", s, flags=re.IGNORECASE)


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    css = (ROOT / "css" / "dashboard.css").read_text(encoding="utf-8")
    data_js = (ROOT / "js" / "data.js").read_text(encoding="utf-8")
    dash_js = (ROOT / "js" / "dashboard.js").read_text(encoding="utf-8")

    html = html.replace(
        '<link rel="stylesheet" href="css/dashboard.css" />',
        f"<style>\n{css}\n</style>",
    )
    bundle = (
        f"<script>\n{escape_for_script(data_js)}\n</script>\n"
        f"<script>\n{escape_for_script(dash_js)}\n</script>"
    )
    html = html.replace(
        '<script src="js/data.js" defer></script>\n    <script src="js/dashboard.js" defer></script>',
        bundle,
    )
    OUT.write_text(html, encoding="utf-8")
    print(f"OK: {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
