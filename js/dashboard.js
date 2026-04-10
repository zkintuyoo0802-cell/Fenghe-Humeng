/**
 * 风和投资-胡猛知识库：随笔关键词 + FHA 月报 + 个股表述索引
 */

(function () {
  const state = {
    data: null,
    query: "",
    categoryId: null,
    view: "framework",
    monthlyQuery: "",
    monthlyYear: null,
    stockQuery: "",
    selectedStockId: null,
  };

  const els = {};

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlight(text, q) {
    if (!q || !text) return escapeHtml(text);
    const safe = escapeHtml(text);
    const words = q.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return safe;
    try {
      const pattern = new RegExp(
        "(" +
          words
            .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|") +
          ")",
        "gi"
      );
      return safe.replace(pattern, "<mark>$1</mark>");
    } catch {
      return safe;
    }
  }

  function entryMatches(entry, q) {
    if (!q) return true;
    const hay = [
      entry.title,
      entry.summary,
      entry.logicRole || "",
      (entry.tags || []).join(" "),
      (entry.aliases || []).join(" "),
    ]
      .join("\n")
      .toLowerCase();
    const words = q
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.every((w) => hay.includes(w));
  }

  function reportMatches(report, q) {
    if (!q) return true;
    const hay = [
      report.id || "",
      report.label || "",
      report.period || "",
      (report.themes || []).join(" "),
      (report.frameworkBridge || []).join(" "),
      JSON.stringify(report.performance || {}),
      JSON.stringify(report.portfolio || {}),
    ]
      .join("\n")
      .toLowerCase();
    const words = q
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.every((w) => hay.includes(w));
  }

  function getStocksArray() {
    const sm = state.data && state.data.stockMentions;
    return (sm && sm.stocks) || [];
  }

  /** 与 scripts/embed-data.py 中 merge_stock_mentions 一致（HTTP 加载 JSON 时用）。 */
  function mergeStockMentionsClientSide(monthlyFile, essayFile) {
    const meta = Object.assign({}, monthlyFile.meta || {});
    if (essayFile && essayFile.meta) meta.essay = essayFile.meta;
    meta.title = "个股与表述索引（FHA 月报 + 随笔案例）";

    const byId = {};

    (monthlyFile.stocks || []).forEach((s) => {
      const sid = s.id;
      const mentions = (s.mentions || []).map((m) =>
        Object.assign({}, m, { source: "monthly" })
      );
      byId[sid] = Object.assign({}, s, { mentions });
    });

    (essayFile.stocks || []).forEach((s) => {
      const sid = s.id;
      const em = (s.mentions || []).map((m) =>
        Object.assign({}, m, { source: "essay" })
      );
      if (byId[sid]) {
        byId[sid].mentions = byId[sid].mentions.concat(em);
        byId[sid].aliases = Array.from(
          new Set([...(byId[sid].aliases || []), ...(s.aliases || [])])
        );
        byId[sid].tickers = Array.from(
          new Set([...(byId[sid].tickers || []), ...(s.tickers || [])])
        );
      } else {
        byId[sid] = Object.assign({}, s, { mentions: em });
      }
    });

    return { meta, stocks: Object.values(byId) };
  }

  function stockMatches(stock, q) {
    if (!q) return true;
    const mentionText = (stock.mentions || [])
      .map((m) =>
        [
          m.quote,
          m.summary,
          m.essayTitle,
          m.action,
          m.reportId,
        ].join(" ")
      )
      .join(" ");
    const hay = [
      stock.displayName || "",
      (stock.aliases || []).join(" "),
      (stock.tickers || []).join(" "),
      stock.id || "",
      mentionText,
    ]
      .join("\n")
      .toLowerCase();
    const words = q
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return words.every((w) => hay.includes(w));
  }

  function getFilteredStocks() {
    return getStocksArray().filter((s) => stockMatches(s, state.stockQuery));
  }

  function getStocksForReport(reportId) {
    return getStocksArray().filter((s) =>
      (s.mentions || []).some((m) => m.reportId === reportId)
    );
  }

  function getReportLabel(reportId) {
    const reports = (state.data.monthlyInsights && state.data.monthlyInsights.reports) || [];
    const r = reports.find((x) => x.id === reportId);
    return r ? r.label || r.period || reportId : reportId;
  }

  function getFilteredEntries() {
    const { data, query, categoryId } = state;
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => {
      if (categoryId && e.category !== categoryId) return false;
      return entryMatches(e, query);
    });
  }

  function getMonthlyReports() {
    const mi = state.data && state.data.monthlyInsights;
    if (!mi || !mi.reports) return [];
    let list = mi.reports.slice();
    if (state.monthlyYear) {
      list = list.filter((r) => String(r.period || "").startsWith(state.monthlyYear));
    }
    return list.filter((r) => reportMatches(r, state.monthlyQuery));
  }

  function renderChips() {
    const { data } = state;
    if (!data || !data.categories) return;
    const frag = document.createDocumentFragment();
    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip" + (state.categoryId === null ? " active" : "");
    all.textContent = "全部";
    all.dataset.category = "";
    frag.appendChild(all);

    data.categories
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (state.categoryId === c.id ? " active" : "");
        b.textContent = c.label;
        b.dataset.category = c.id;
        frag.appendChild(b);
      });

    els.chipsContainer.innerHTML = "";
    els.chipsContainer.appendChild(frag);
  }

  function renderYearChips() {
    const years = ["2025", "2026"];
    const frag = document.createDocumentFragment();
    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip" + (state.monthlyYear === null ? " active" : "");
    all.textContent = "全部";
    all.dataset.year = "";
    frag.appendChild(all);
    years.forEach((y) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (state.monthlyYear === y ? " active" : "");
      b.textContent = y;
      b.dataset.year = y;
      frag.appendChild(b);
    });
    els.yearChips.innerHTML = "";
    els.yearChips.appendChild(frag);
  }

  function renderCards() {
    const list = getFilteredEntries();
    const q = state.query;

    els.statsCount.textContent = String(list.length);
    els.statsTotal.textContent = String(state.data.entries.length);

    if (list.length === 0) {
      els.cardGrid.innerHTML =
        '<div class="empty-state">无匹配条目。请调整关键词或分类。</div>';
      return;
    }

    const catMap = {};
    state.data.categories.forEach((c) => {
      catMap[c.id] = c.label;
    });

    els.cardGrid.innerHTML = list
      .map((entry) => {
        const catLabel = catMap[entry.category] || entry.category;
        const aliases = (entry.aliases || [])
          .slice(0, 12)
          .map((a) => `<span>${highlight(a, q)}</span>`)
          .join("");
        const see = (entry.seeAlso || [])
          .map((id) => {
            const t = state.data.entries.find((x) => x.id === id);
            return t ? t.title : id;
          })
          .join(" · ");
        const relIds = entry.relatedStockIds || [];
        const relStocks = relIds
          .map((sid) => {
            const st = getStocksArray().find((x) => x.id === sid);
            const lab = st ? st.displayName : sid;
            return `<button type="button" class="fw-stock-chip" data-stock-id="${escapeHtml(sid)}">${escapeHtml(lab)}</button>`;
          })
          .join("");
        const relRow = relStocks
          ? `<p class="category-label" style="margin-top:0.65rem;">关联个股（随笔/月报索引）</p><div class="bridge-row">${relStocks}</div>`
          : "";
        return `
        <article class="card" data-id="${escapeHtml(entry.id)}">
          <h2>${highlight(entry.title, q)}</h2>
          <div class="meta-row">
            <span class="badge">${escapeHtml(catLabel)}</span>
            ${entry.logicRole ? `<span class="badge logic">${highlight(entry.logicRole, q)}</span>` : ""}
          </div>
          <p class="summary">${highlight(entry.summary, q)}</p>
          <div class="aliases"><strong style="color:var(--muted);font-size:0.75rem;">别名 / 检索词：</strong></div>
          <div class="aliases">${aliases}</div>
          ${relRow}
          ${see ? `<div class="see-also">关联词条：${highlight(see, q)}</div>` : ""}
        </article>`;
      })
      .join("");
  }

  function fmtPct(n) {
    if (n === undefined || n === null || Number.isNaN(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }

  function fmtNum(n) {
    if (n === undefined || n === null) return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    return x.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function stanceClass(stance) {
    if (stance === "short") return "stance-short";
    if (stance === "long") return "stance-long";
    return "stance-other";
  }

  function renderMonthlyIntro() {
    const mi = state.data.monthlyInsights;
    if (!mi || !els.monthlyIntro) return;
    const meta = mi.meta || {};
    els.monthlyIntro.innerHTML = `
      <p class="monthly-intro-lead"><strong>${escapeHtml(meta.title || "")}</strong> — ${escapeHtml(meta.subtitle || "")}</p>
      <p class="monthly-intro-note">${escapeHtml(meta.note || "")}</p>
    `;
  }

  function mentionSortKey(m) {
    if (m.reportId) return m.reportId;
    return String(m.essayYear || "0000") + (m.essayTitle || "");
  }

  function renderMonthlyPerformanceCharts() {
    const host = $("#monthly-chart-wrap");
    if (!host) return;
    const reports = (state.data.monthlyInsights && state.data.monthlyInsights.reports) || [];
    if (reports.length === 0) {
      host.innerHTML = "";
      return;
    }
    const sorted = reports.slice().sort((a, b) => String(a.period || "").localeCompare(String(b.period || "")));
    const mtds = sorted.map((r) =>
      r.performance && r.performance.mtdPct != null ? r.performance.mtdPct : 0
    );
    const ytds = sorted.map((r) =>
      r.performance && r.performance.ytdPct != null ? r.performance.ytdPct : 0
    );
    const maxAbs = Math.max(0.5, ...mtds.map(Math.abs));
    const maxYtd = Math.max(1, ...ytds.map(Math.abs));

    let bestIdx = 0;
    let worstIdx = 0;
    mtds.forEach((v, i) => {
      if (v > mtds[bestIdx]) bestIdx = i;
      if (v < mtds[worstIdx]) worstIdx = i;
    });

    const bars = sorted
      .map((r, i) => {
        const v = mtds[i];
        const h = (Math.abs(v) / maxAbs) * 100;
        const neg = v < 0;
        const shortLab = (r.period || "").slice(5) || r.label || "";
        return `<div class="mtd-bar-col" title="${escapeHtml(r.label || "")} MTD ${fmtPct(v)}">
          <div class="mtd-bar-inner">
            <div class="mtd-bar ${neg ? "neg" : "pos"}" style="height:${h}%"></div>
          </div>
          <span class="mtd-bar-label">${escapeHtml(shortLab)}</span>
        </div>`;
      })
      .join("");

    const n = ytds.length;
    const pts = ytds
      .map((y, i) => {
        const x = n <= 1 ? 50 : (i / (n - 1)) * 100;
        const yy = 38 - (y / maxYtd) * 36;
        return `${x},${yy}`;
      })
      .join(" ");

    const lastYtd = ytds[ytds.length - 1];
    const lastLab = sorted[sorted.length - 1].label || "";

    host.innerHTML = `
      <div class="chart-section">
        <h3 class="chart-title">FHA Asia 月度净收益 MTD（柱状）</h3>
        <div class="mtd-highlight-strip">
          <span>最佳单月：<strong>${escapeHtml(sorted[bestIdx].label || "")}</strong> ${fmtPct(mtds[bestIdx])}</span>
          <span>最弱单月：<strong>${escapeHtml(sorted[worstIdx].label || "")}</strong> ${fmtPct(mtds[worstIdx])}</span>
          <span>期末 YTD：<strong>${fmtPct(lastYtd)}</strong>（${escapeHtml(lastLab)}）</span>
        </div>
        <div class="mtd-chart-row">${bars}</div>
        <h3 class="chart-title">YTD 累计走势（折线，期末值）</h3>
        <div class="ytd-chart-svg-wrap">
          <svg class="ytd-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" y1="38" x2="100" y2="38" stroke="var(--border)" stroke-width="0.2" />
            <polyline fill="none" stroke="var(--accent)" stroke-width="0.7" points="${pts}" />
          </svg>
          <div class="ytd-x-labels">${sorted
            .map((r) => `<span>${escapeHtml((r.period || "").replace(/^\d{4}-/, ""))}</span>`)
            .join("")}</div>
        </div>
      </div>
    `;
  }

  function renderMonthlyTable() {
    const mi = state.data.monthlyInsights;
    if (!mi || !els.monthlyTableBody) return;
    const all = mi.reports || [];
    els.monthlyTableBody.innerHTML = all
      .map((r) => {
        const p = r.performance || {};
        const pf = r.portfolio || {};
        return `<tr>
          <td>${escapeHtml(r.label || r.period || "")}</td>
          <td>${fmtPct(p.mtdPct)}</td>
          <td>${fmtPct(p.ytdPct)}</td>
          <td>${fmtPct(p.ttmPct)}</td>
          <td>${pf.leverage != null ? escapeHtml(String(pf.leverage)) : "—"}</td>
          <td>${fmtNum(pf.aumUsdMil)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderMonthlyCards() {
    const list = getMonthlyReports();
    const q = state.monthlyQuery;
    const total = (state.data.monthlyInsights && state.data.monthlyInsights.reports) || [];
    let denom = total.length;
    if (state.monthlyYear) {
      denom = total.filter((r) => String(r.period || "").startsWith(state.monthlyYear)).length;
    }
    els.monthlyStatCount.textContent = String(list.length);
    els.monthlyStatTotal.textContent = String(denom);

    if (list.length === 0) {
      els.monthlyCardGrid.innerHTML =
        '<div class="empty-state">无匹配月报。请调整检索词或年份。</div>';
      return;
    }

    els.monthlyCardGrid.innerHTML = list
      .map((r) => {
        const p = r.performance || {};
        const pf = r.portfolio || {};
        const themes = (r.themes || [])
          .map((t) => `<li>${highlight(t, q)}</li>`)
          .join("");
        const bridges = (r.frameworkBridge || [])
          .map(
            (b) =>
              `<button type="button" class="bridge-chip" data-bridge="${escapeHtml(b)}">${escapeHtml(b)}</button>`
          )
          .join(" ");
        const stocks = getStocksForReport(r.id);
        const stockRow =
          stocks.length > 0
            ? `<p class="category-label" style="margin-top:0.75rem;">本期涉及个股</p>
          <div class="stock-mini-row">${stocks
            .map(
              (s) =>
                `<button type="button" class="stock-mini-chip" data-stock-id="${escapeHtml(s.id)}">${escapeHtml(s.displayName)}</button>`
            )
            .join("")}</div>`
            : "";
        return `
        <article class="card monthly-card">
          <h2>${highlight(r.label || r.period, q)}</h2>
          <div class="meta-row monthly-metrics">
            <span class="badge">MTD ${fmtPct(p.mtdPct)}</span>
            <span class="badge">YTD ${fmtPct(p.ytdPct)}</span>
            <span class="badge">TTM ${fmtPct(p.ttmPct)}</span>
            ${pf.leverage != null ? `<span class="badge">杠杆 ${escapeHtml(String(pf.leverage))}</span>` : ""}
            ${pf.aumUsdMil != null ? `<span class="badge">AUM ${fmtNum(pf.aumUsdMil)}m</span>` : ""}
          </div>
          <p class="category-label" style="margin-top:0.75rem;">观点摘要</p>
          <ul class="monthly-themes">${themes}</ul>
          ${stockRow}
          <p class="category-label" style="margin-top:0.75rem;">与随笔框架对照</p>
          <div class="bridge-row">${bridges || "<span class=\"muted\">—</span>"}</div>
        </article>`;
      })
      .join("");
  }

  function renderStockSidebar() {
    const list = getFilteredStocks();
    if (!els.stockList) return;
    els.stockList.innerHTML = list
      .map((s) => {
        const n = (s.mentions || []).length;
        const active = s.id === state.selectedStockId ? " stock-list-item-active" : "";
        return `<button type="button" class="stock-list-item${active}" data-stock-id="${escapeHtml(s.id)}" role="option">
          <span class="stock-list-name">${escapeHtml(s.displayName)}</span>
          <span class="stock-list-meta">${n} 条</span>
        </button>`;
      })
      .join("");
    if (list.length === 0) {
      els.stockList.innerHTML =
        '<div class="empty-state" style="padding:1rem;">无匹配标的</div>';
    }
  }

  function renderStockPanel() {
    const sm = state.data.stockMentions;
    if (!sm || !els.stockPanelIntro) return;
    const essayMeta = sm.meta && sm.meta.essay;
    els.stockPanelIntro.innerHTML = `
      <p class="monthly-intro-lead"><strong>${escapeHtml((sm.meta && sm.meta.title) || "个股索引")}</strong></p>
      <p class="monthly-intro-note">${escapeHtml((sm.meta && sm.meta.note) || "")}</p>
      ${
        essayMeta
          ? `<p class="monthly-intro-note"><strong>随笔案例：</strong>${escapeHtml(essayMeta.title || "")}（${escapeHtml(essayMeta.source || "")}）</p>`
          : ""
      }
    `;

    const stock = getStocksArray().find((s) => s.id === state.selectedStockId);
    if (!stock) {
      els.stockMentionCount.textContent = "0";
      els.stockDetail.innerHTML =
        '<div class="empty-state">左侧选择一只个股，查看 <strong>月报</strong> 与 <strong>《风和投资随笔》</strong> 中的历史表述与操作类型。可从「随笔框架」词条卡片上的关联个股跳转，或从「月报」卡片标签进入。</div>';
      return;
    }

    const mentions = (stock.mentions || []).slice().sort((a, b) => {
      return mentionSortKey(a).localeCompare(mentionSortKey(b));
    });
    els.stockMentionCount.textContent = String(mentions.length);

    const tickers = (stock.tickers || []).filter(Boolean).join(" · ") || "—";
    const aliases = (stock.aliases || []).slice(0, 12).join(" · ");

    const rows = mentions
      .map((m, idx) => {
        const st = m.stance || "";
        const sc = stanceClass(st);
        const src = m.source === "essay" ? "随笔" : "月报";
        let periodCell = "";
        if (m.reportId) {
          periodCell = `<button type="button" class="linkish open-report" data-report-id="${escapeHtml(m.reportId)}">${escapeHtml(getReportLabel(m.reportId))}</button>`;
        } else {
          periodCell = `<span>${escapeHtml(m.essayTitle || "—")}</span> <span class="muted">(${escapeHtml(String(m.essayYear || ""))})</span>`;
        }
        const kwIds = m.relatedKeywordIds || [];
        const kwBtns = kwIds
          .map((kid) => {
            const ent = state.data.entries.find((e) => e.id === kid);
            if (!ent) return "";
            return `<button type="button" class="kw-open-chip" data-kw-id="${escapeHtml(kid)}">${escapeHtml(ent.title)}</button>`;
          })
          .join(" ");
        return `<tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(src)}</td>
          <td>${periodCell}</td>
          <td><span class="stance-tag ${sc}">${escapeHtml(st)}</span></td>
          <td>${escapeHtml(m.action || "—")}</td>
          <td class="stock-td-quote"><blockquote class="stock-quote">${escapeHtml(m.quote || m.summary || "")}</blockquote></td>
          <td class="stock-td-kw">${kwBtns || "—"}</td>
        </tr>`;
      })
      .join("");

    els.stockDetail.innerHTML = `
      <div class="stock-detail-head">
        <h2 class="stock-detail-title">${escapeHtml(stock.displayName)}</h2>
        <p class="stock-detail-sub muted">别名：${escapeHtml(aliases)}</p>
        <p class="stock-detail-sub muted">代码：${escapeHtml(tickers)}</p>
      </div>
      <div class="monthly-table-wrap">
        <table class="monthly-table stock-timeline-table">
          <thead>
            <tr>
              <th>#</th>
              <th>来源</th>
              <th>月报期 / 随笔篇名</th>
              <th>方向/类型</th>
              <th>操作/性质</th>
              <th>引用原文</th>
              <th>关联框架词条</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function openMonthlyReport(reportId) {
    state.monthlyQuery = reportId;
    state.monthlyYear = null;
    els.searchMonthly.value = reportId;
    switchView("monthly");
    renderYearChips();
    renderMonthlyCards();
  }

  function selectStock(stockId) {
    state.selectedStockId = stockId;
    renderStockSidebar();
    renderStockPanel();
  }

  function openFrameworkEntry(entryId) {
    const ent =
      state.data &&
      state.data.entries &&
      state.data.entries.find((e) => e.id === entryId);
    if (!ent) return;
    state.query = "";
    state.categoryId = ent.category;
    els.searchInput.value = "";
    switchView("framework");
    renderChips();
    renderCards();
    requestAnimationFrame(() => {
      const card =
        els.cardGrid &&
        els.cardGrid.querySelector(`article.card[data-id="${entryId}"]`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function switchView(view) {
    state.view = view;
    document.querySelectorAll(".view-tab").forEach((btn) => {
      const on = btn.dataset.view === view;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    const showFw = view === "framework";
    const showMo = view === "monthly";
    const showSt = view === "stocks";

    els.sidebarFramework.classList.toggle("hidden", !showFw);
    els.sidebarMonthly.classList.toggle("hidden", !showMo);
    els.sidebarStocks.classList.toggle("hidden", !showSt);
    els.panelFramework.classList.toggle("hidden", !showFw);
    els.panelMonthly.classList.toggle("hidden", !showMo);
    els.panelStocks.classList.toggle("hidden", !showSt);

    if (showMo) {
      renderMonthlyIntro();
      renderMonthlyPerformanceCharts();
      renderMonthlyTable();
      renderYearChips();
      renderMonthlyCards();
    }
    if (showSt) {
      renderStockSidebar();
      renderStockPanel();
    }
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value;
      renderCards();
    });

    els.chipsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const cat = btn.dataset.category;
      state.categoryId = cat === "" ? null : cat;
      renderChips();
      renderCards();
    });

    els.cardGrid.addEventListener("click", (e) => {
      const chip = e.target.closest(".fw-stock-chip");
      if (!chip || !chip.dataset.stockId) return;
      e.preventDefault();
      state.selectedStockId = chip.dataset.stockId;
      state.stockQuery = "";
      els.searchStock.value = "";
      switchView("stocks");
      renderStockSidebar();
      renderStockPanel();
    });

    els.exportBtn.addEventListener("click", () => {
      const list = getFilteredEntries();
      const blob = new Blob([JSON.stringify(list, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fenghe-filtered-keywords.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    els.viewTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-tab");
      if (!btn || !btn.dataset.view) return;
      switchView(btn.dataset.view);
    });

    els.searchMonthly.addEventListener("input", (e) => {
      state.monthlyQuery = e.target.value;
      renderMonthlyCards();
    });

    els.yearChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      const y = btn.dataset.year;
      state.monthlyYear = y === "" ? null : y;
      renderYearChips();
      renderMonthlyCards();
    });

    els.exportMonthlyJson.addEventListener("click", () => {
      const list = getMonthlyReports();
      const blob = new Blob([JSON.stringify(list, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "fenghe-filtered-monthly.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    els.monthlyCardGrid.addEventListener("click", (e) => {
      const bridge = e.target.closest(".bridge-chip");
      if (bridge && bridge.dataset.bridge) {
        const term = bridge.dataset.bridge;
        state.query = term;
        state.categoryId = null;
        els.searchInput.value = term;
        switchView("framework");
        renderChips();
        renderCards();
        return;
      }
      const stockMini = e.target.closest(".stock-mini-chip");
      if (stockMini && stockMini.dataset.stockId) {
        state.selectedStockId = stockMini.dataset.stockId;
        state.stockQuery = "";
        els.searchStock.value = "";
        switchView("stocks");
        renderStockSidebar();
        renderStockPanel();
      }
    });

    els.searchStock.addEventListener("input", (e) => {
      state.stockQuery = e.target.value;
      renderStockSidebar();
    });

    els.stockList.addEventListener("click", (e) => {
      const btn = e.target.closest(".stock-list-item");
      if (!btn || !btn.dataset.stockId) return;
      selectStock(btn.dataset.stockId);
    });

    els.stockDetail.addEventListener("click", (e) => {
      const kw = e.target.closest(".kw-open-chip");
      if (kw && kw.dataset.kwId) {
        e.preventDefault();
        openFrameworkEntry(kw.dataset.kwId);
        return;
      }
      const btn = e.target.closest(".open-report");
      if (!btn || !btn.dataset.reportId) return;
      openMonthlyReport(btn.dataset.reportId);
    });

    els.exportStockJson.addEventListener("click", () => {
      const stock = getStocksArray().find((s) => s.id === state.selectedStockId);
      const payload = stock || getFilteredStocks();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = state.selectedStockId
        ? "fenghe-stock-" + state.selectedStockId + ".json"
        : "fenghe-stocks-filtered.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  async function loadKnowledgeBase() {
    if (typeof window.__FENGHE_KB__ === "object" && window.__FENGHE_KB__ !== null) {
      return window.__FENGHE_KB__;
    }
    const resKw = await fetch("data/keywords.json");
    if (!resKw.ok) throw new Error("无法加载 keywords.json");
    const kw = await resKw.json();
    let mi = { meta: {}, reports: [] };
    let st = { meta: {}, stocks: [] };
    try {
      const resMi = await fetch("data/monthly-insights.json");
      if (resMi.ok) mi = await resMi.json();
    } catch (_) {}
    try {
      const resSt = await fetch("data/stock-mentions.json");
      if (resSt.ok) st = await resSt.json();
    } catch (_) {}
    try {
      const resEs = await fetch("data/essay-stock-mentions.json");
      if (resEs.ok) {
        const essay = await resEs.json();
        st = mergeStockMentionsClientSide(st, essay);
      }
    } catch (_) {}
    return { ...kw, monthlyInsights: mi, stockMentions: st };
  }

  async function init() {
    els.searchInput = $("#search");
    els.chipsContainer = $("#category-chips");
    els.cardGrid = $("#card-grid");
    els.statsCount = $("#stat-count");
    els.statsTotal = $("#stat-total");
    els.exportBtn = $("#export-json");
    els.metaTitle = $("#meta-title");
    els.metaSubtitle = $("#meta-subtitle");
    els.viewTabs = $("#view-tabs");
    els.sidebarFramework = $("#sidebar-framework");
    els.sidebarMonthly = $("#sidebar-monthly");
    els.sidebarStocks = $("#sidebar-stocks");
    els.panelFramework = $("#panel-framework");
    els.panelMonthly = $("#panel-monthly");
    els.panelStocks = $("#panel-stocks");
    els.searchMonthly = $("#search-monthly");
    els.yearChips = $("#year-chips");
    els.monthlyIntro = $("#monthly-intro");
    els.monthlyTableBody = $("#monthly-table-body");
    els.monthlyCardGrid = $("#monthly-card-grid");
    els.monthlyStatCount = $("#monthly-stat-count");
    els.monthlyStatTotal = $("#monthly-stat-total");
    els.exportMonthlyJson = $("#export-monthly-json");
    els.searchStock = $("#search-stock");
    els.stockList = $("#stock-list");
    els.stockPanelIntro = $("#stock-panel-intro");
    els.stockDetail = $("#stock-detail");
    els.stockMentionCount = $("#stock-mention-count");
    els.exportStockJson = $("#export-stock-json");

    state.data = await loadKnowledgeBase();

    els.metaTitle.textContent = "风和投资-胡猛知识库";
    const v = state.data.meta && state.data.meta.version;
    els.metaSubtitle.textContent =
      (state.data.meta && state.data.meta.title) +
      " · " +
      (state.data.meta && state.data.meta.source) +
      (v ? " · v" + v : "");

    if (!state.data.monthlyInsights || !state.data.monthlyInsights.reports) {
      state.data.monthlyInsights = { meta: {}, reports: [] };
    }
    if (!state.data.stockMentions || !state.data.stockMentions.stocks) {
      state.data.stockMentions = { meta: {}, stocks: [] };
    }

    renderChips();
    renderCards();
    renderMonthlyIntro();
    renderMonthlyPerformanceCharts();
    renderMonthlyTable();
    renderYearChips();
    renderMonthlyCards();
    renderStockSidebar();
    renderStockPanel();
    bindEvents();
  }

  init().catch((err) => {
    console.error(err);
    const grid = document.getElementById("card-grid");
    if (!grid) return;
    const fileHint =
      typeof location !== "undefined" && location.protocol === "file:"
        ? "本地 <code>file://</code> 打开时浏览器禁止用 fetch 读取 <code>data/*.json</code>，因此<strong>必须</strong>存在已嵌入数据的 <code>js/data.js</code>（运行 <code>scripts/embed-data.py</code>），或改用同目录的 <code>index.standalone.html</code>。"
        : "请运行 <code>scripts/embed-data.py</code> 生成 <code>js/data.js</code>，并确认可通过 HTTP 访问 <code>data/*.json</code>。";
    grid.innerHTML =
      "<div class=\"empty-state\">加载失败。" + fileHint + "</div>";
  });
})();
