#!/usr/bin/env python3
"""合并 keywords / monthly-insights / stock-mentions / essay-stock-mentions 生成 js/data.js。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KW = ROOT / "data" / "keywords.json"
MI = ROOT / "data" / "monthly-insights.json"
ST = ROOT / "data" / "stock-mentions.json"
ES = ROOT / "data" / "essay-stock-mentions.json"
OUT = ROOT / "js" / "data.js"


def merge_stock_mentions(monthly_file: dict, essay_file: dict) -> dict:
    """月报个股 + 随笔案例：按 id 合并 mentions，并标注 source。"""
    meta = dict(monthly_file.get("meta") or {})
    if essay_file.get("meta"):
        meta["essay"] = essay_file["meta"]
    meta["title"] = "个股与表述索引（FHA 月报 + 随笔案例）"

    by_id: dict = {}

    for s in monthly_file.get("stocks", []):
        sid = s["id"]
        mentions = []
        for m in s.get("mentions", []):
            mm = dict(m)
            mm["source"] = "monthly"
            mentions.append(mm)
        by_id[sid] = {**s, "mentions": mentions}

    for s in essay_file.get("stocks", []):
        sid = s["id"]
        em = []
        for m in s.get("mentions", []):
            mm = dict(m)
            mm["source"] = "essay"
            em.append(mm)
        if sid in by_id:
            by_id[sid]["mentions"].extend(em)
            merged_aliases = list(
                dict.fromkeys(
                    (by_id[sid].get("aliases") or []) + (s.get("aliases") or [])
                )
            )
            merged_tickers = list(
                dict.fromkeys(
                    (by_id[sid].get("tickers") or []) + (s.get("tickers") or [])
                )
            )
            by_id[sid]["aliases"] = merged_aliases
            by_id[sid]["tickers"] = merged_tickers
        else:
            by_id[sid] = {**s, "mentions": em}

    return {"meta": meta, "stocks": list(by_id.values())}


def main() -> None:
    kw = json.loads(KW.read_text(encoding="utf-8"))
    mi = json.loads(MI.read_text(encoding="utf-8"))
    st = json.loads(ST.read_text(encoding="utf-8"))
    essay = json.loads(ES.read_text(encoding="utf-8"))
    merged_st = merge_stock_mentions(st, essay)
    bundle = {**kw, "monthlyInsights": mi, "stockMentions": merged_st}
    OUT.write_text(
        "window.__FENGHE_KB__ = " + json.dumps(bundle, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(f"OK: {KW} + {MI} + {ST} + {ES} -> {OUT}")
    print("提示: 若需单文件分发，请再运行 python scripts/build-standalone.py 生成 index.standalone.html")


if __name__ == "__main__":
    main()
