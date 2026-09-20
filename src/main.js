import "./styles.css";

const STORAGE_KEY = "zfl-14-repairs";
const statuses = {
  all: "全部",
  todo: "待处理",
  doing: "处理中",
  done: "已完成"
};

const priorities = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

let state = loadState();
saveState();
const app = document.querySelector("#app");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    parsed.filter = parsed.filter || "all";
    parsed.repairs = (parsed.repairs || []).map(normalizeRepair);
    return parsed;
  }
  return {
    filter: "all",
    repairs: [
      normalizeRepair({
        id: crypto.randomUUID(),
        location: "厨房",
        title: "水槽下方渗水",
        priority: "high",
        cost: 260,
        status: "todo",
        photo: "",
        note: "先检查软管接口",
        quotes: [
          {
            id: crypto.randomUUID(),
            contractor: "李师傅水电",
            promisedCost: 280,
            visitDate: "2026-09-22",
            warrantyDays: 90,
            createdAt: new Date().toISOString()
          },
          {
            id: crypto.randomUUID(),
            contractor: "安心家政维修",
            promisedCost: 320,
            visitDate: "2026-09-21",
            warrantyDays: 180,
            createdAt: new Date().toISOString()
          }
        ]
      })
    ]
  };
}

function normalizeRepair(repair) {
  return {
    id: repair.id,
    location: repair.location,
    title: repair.title,
    priority: repair.priority,
    cost: repair.cost,
    status: repair.status,
    photo: repair.photo || "",
    note: repair.note || "",
    quotes: Array.isArray(repair.quotes) ? repair.quotes : [],
    activeQuoteId: repair.activeQuoteId || null,
    quoteHistory: Array.isArray(repair.quoteHistory) ? repair.quoteHistory : [],
    rectifications: Array.isArray(repair.rectifications) ? repair.rectifications : [],
    completion: repair.completion || null
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findRepair(id) {
  return state.repairs.find((repair) => repair.id === id);
}

function activeQuote(repair) {
  return repair.quotes.find((quote) => quote.id === repair.activeQuoteId) || null;
}

function render() {
  const repairs = filteredRepairs();
  const unfinished = state.repairs.filter((repair) => repair.status !== "done");
  const doing = state.repairs.filter((repair) => repair.status === "doing").length;
  const pendingCost = unfinished.reduce((total, repair) => {
    const quote = activeQuote(repair);
    return total + (quote ? Number(quote.promisedCost) : Number(repair.cost || 0));
  }, 0);
  const paidCost = state.repairs
    .filter((repair) => repair.status === "done" && repair.completion)
    .reduce((total, repair) => total + Number(repair.completion.actualCost || 0), 0);

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">本地家庭维护台</p>
          <h1>家庭维修事项</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>未完成</span><strong>${unfinished.length}</strong></div>
          <div class="stat"><span>处理中</span><strong>${doing}</strong></div>
          <div class="stat"><span>待支付费用</span><strong>¥${pendingCost}</strong></div>
          <div class="stat"><span>已实付费用</span><strong>¥${paidCost}</strong></div>
        </section>
      </header>

      <section class="layout">
        <aside class="panel">
          <h2>新增维修事项</h2>
          <form class="form" id="repair-form">
            <label>位置<input name="location" required placeholder="例如卫生间"></label>
            <label>问题描述<textarea name="title" required placeholder="例如门锁松动"></textarea></label>
            <label>优先级<select name="priority">${renderPriorityOptions("medium")}</select></label>
            <label>预计费用<input name="cost" type="number" min="0" step="1" value="0"></label>
            <label>照片链接<input name="photo" type="url" placeholder="可选，粘贴图片地址"></label>
            <label>备注<textarea name="note" placeholder="师傅电话、材料或注意事项"></textarea></label>
            <p class="hint">新事项默认为待处理，添加候选报价并选定后进入处理中。</p>
            <button class="primary" type="submit">保存事项</button>
          </form>
        </aside>

        <section>
          <div class="toolbar">
            ${Object.entries(statuses).map(([value, label]) => `<button class="seg ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`).join("")}
          </div>
          <div class="repairs">
            ${repairs.length ? repairs.map(renderRepair).join("") : `<div class="empty">当前状态下没有维修事项</div>`}
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
}

function renderRepair(repair) {
  const quote = activeQuote(repair);
  return `
    <article class="repair">
      <div class="photo">${repair.photo ? `<img src="${escapeHtml(repair.photo)}" alt="${escapeHtml(repair.location)}维修照片">` : "未添加照片"}</div>
      <div class="content">
        <div class="row">
          <h3>${escapeHtml(repair.location)}</h3>
          <span class="priority ${repair.priority}">${priorities[repair.priority]}</span>
          <span class="status ${repair.status}">${statuses[repair.status]}</span>
          ${quote ? `<span class="status locked">报价已锁定</span>` : ""}
        </div>
        <p>${escapeHtml(repair.title)}</p>
        <div class="row">
          ${renderCostChip(repair, quote)}
          <span class="chip">${escapeHtml(repair.note || "暂无备注")}</span>
        </div>
        ${renderQuoteArea(repair, quote)}
        ${renderRectifications(repair)}
        ${renderHistory(repair)}
        <div class="actions">
          <button class="ghost" data-delete="${repair.id}">删除事项</button>
        </div>
      </div>
    </article>
  `;
}

function renderCostChip(repair, quote) {
  if (repair.status === "done" && repair.completion) {
    return `<span class="chip">实付 ¥${Number(repair.completion.actualCost)}</span>`;
  }
  if (quote) return `<span class="chip">承诺 ¥${Number(quote.promisedCost)}</span>`;
  return `<span class="chip">预计 ¥${Number(repair.cost || 0)}</span>`;
}

function renderQuoteArea(repair, quote) {
  if (repair.status === "done") return renderCompletion(repair);
  if (quote) return renderLockedQuote(repair, quote);
  return renderCandidates(repair);
}

function renderCandidates(repair) {
  const items = repair.quotes
    .map(
      (quote) => `
        <li class="quote-item">
          <div class="quote-detail">
            <strong>${escapeHtml(quote.contractor)}</strong>
            <span>承诺 ¥${Number(quote.promisedCost)}</span>
            <span>上门 ${escapeHtml(quote.visitDate)}</span>
            <span>保修 ${Number(quote.warrantyDays)} 天</span>
          </div>
          <div class="quote-actions">
            <button class="primary small" data-select-quote="${repair.id}:${quote.id}">选定并锁定</button>
            <button class="ghost small" data-remove-quote="${repair.id}:${quote.id}">删除</button>
          </div>
        </li>`
    )
    .join("");

  return `
    <section class="quote-box" data-quote-box="${repair.id}">
      <h4>候选报价</h4>
      ${items ? `<ul class="quote-list">${items}</ul>` : `<p class="hint">暂无候选报价，添加后可选定一条并锁定。</p>`}
      <form class="quote-form" data-quote-form="${repair.id}">
        <div class="quote-grid">
          <input name="contractor" placeholder="施工方 *">
          <input name="promisedCost" type="number" min="0" step="1" placeholder="承诺费用 *">
          <input name="visitDate" type="date" aria-label="上门日期" title="上门日期 *">
          <input name="warrantyDays" type="number" min="0" step="1" placeholder="保修天数 *">
        </div>
        <button class="ghost" type="submit">添加候选报价</button>
      </form>
      <p class="error" data-error hidden></p>
    </section>
  `;
}

function renderLockedQuote(repair, quote) {
  return `
    <section class="quote-box locked-box">
      <h4>🔒 已锁定报价</h4>
      <div class="quote-detail">
        <strong>${escapeHtml(quote.contractor)}</strong>
        <span>承诺 ¥${Number(quote.promisedCost)}</span>
        <span>上门 ${escapeHtml(quote.visitDate)}</span>
        <span>保修 ${Number(quote.warrantyDays)} 天</span>
      </div>
      <div class="actions">
        <button class="primary" data-toggle-complete="${repair.id}">完工验收</button>
        <button class="ghost danger" data-toggle-terminate="${repair.id}">终止报价</button>
      </div>
      <form class="panel-form" data-complete-form="${repair.id}" data-promised="${Number(quote.promisedCost)}" hidden>
        <div class="quote-grid">
          <input name="actualCost" type="number" min="0" step="1" placeholder="实付费用 *">
          <select name="conclusion" aria-label="验收结论">
            <option value="">验收结论 *</option>
            <option value="passed">验收通过</option>
            <option value="returned">验收退回</option>
          </select>
        </div>
        <input name="overrunReason" data-overrun placeholder="超支原因（实付超过承诺费用时必填）" hidden>
        <textarea name="rectification" data-rectification placeholder="整改说明（验收退回时必填）" hidden></textarea>
        <p class="error" data-error hidden></p>
        <button class="primary" type="submit">提交验收结果</button>
      </form>
      <form class="panel-form" data-terminate-form="${repair.id}" hidden>
        <input name="reason" placeholder="终止原因 *">
        <p class="error" data-error hidden></p>
        <button class="ghost danger" type="submit">确认终止并释放报价</button>
      </form>
    </section>
  `;
}

function renderCompletion(repair) {
  const completion = repair.completion;
  if (!completion) return "";
  return `
    <section class="quote-box done-box">
      <h4>✅ 验收通过</h4>
      <div class="quote-detail">
        <strong>${escapeHtml(completion.contractor)}</strong>
        <span>实付 ¥${Number(completion.actualCost)}</span>
        <span>承诺 ¥${Number(completion.promisedCost)}</span>
        <span>保修 ${Number(completion.warrantyDays)} 天</span>
        <span>完工 ${fmtDate(completion.completedAt)}</span>
      </div>
      ${completion.overrunReason ? `<p class="overrun">超支原因：${escapeHtml(completion.overrunReason)}</p>` : ""}
    </section>
  `;
}

function renderRectifications(repair) {
  if (!repair.rectifications.length) return "";
  const items = repair.rectifications
    .map((item) => `<li>${fmtDate(item.at)} 验收退回：${escapeHtml(item.note)}</li>`)
    .join("");
  return `<ul class="rectifications">${items}</ul>`;
}

function renderHistory(repair) {
  if (!repair.quoteHistory.length) return "";
  const items = repair.quoteHistory
    .map(
      (quote) => `
        <li>
          <strong>${escapeHtml(quote.contractor)}</strong> · 承诺 ¥${Number(quote.promisedCost)} ·
          ${quote.outcome === "terminated" ? `已终止：${escapeHtml(quote.reason)}` : "已完成"} · ${fmtDate(quote.closedAt)}
        </li>`
    )
    .join("");
  return `
    <details class="history">
      <summary>报价历史（${repair.quoteHistory.length}）</summary>
      <ul>${items}</ul>
    </details>
  `;
}

function renderPriorityOptions(selected) {
  return Object.entries(priorities)
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function bindEvents() {
  document.querySelector("#repair-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.repairs.unshift(
      normalizeRepair({
        id: crypto.randomUUID(),
        location: data.location.trim(),
        title: data.title.trim(),
        priority: data.priority,
        cost: Number(data.cost || 0),
        status: "todo",
        photo: data.photo.trim(),
        note: data.note.trim()
      })
    );
    saveState();
    render();
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.repairs = state.repairs.filter((repair) => repair.id !== button.dataset.delete);
      saveState();
      render();
    });
  });

  // 添加候选报价：施工方、承诺费用、上门日期、保修天数缺一即整次拒绝
  document.querySelectorAll("[data-quote-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const repair = findRepair(form.dataset.quoteForm);
      if (!repair || repair.status === "done" || activeQuote(repair)) return;
      const data = Object.fromEntries(new FormData(form));
      const error = validateQuoteInput(data);
      if (error) return showError(form, error);
      repair.quotes.push({
        id: crypto.randomUUID(),
        contractor: data.contractor.trim(),
        promisedCost: Number(data.promisedCost),
        visitDate: data.visitDate,
        warrantyDays: Number(data.warrantyDays),
        createdAt: new Date().toISOString()
      });
      saveState();
      render();
    });
  });

  // 选定候选报价：报价不完整则整次拒绝，原报价和状态不变；通过后转处理中并锁定
  document.querySelectorAll("[data-select-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      const [repairId, quoteId] = button.dataset.selectQuote.split(":");
      const repair = findRepair(repairId);
      if (!repair || repair.status === "done" || repair.activeQuoteId) return;
      const quote = repair.quotes.find((item) => item.id === quoteId);
      if (!isQuoteComplete(quote)) {
        return showError(button.closest(".quote-box"), "该报价缺少施工方、承诺费用、上门日期或保修天数，无法选定");
      }
      repair.activeQuoteId = quote.id;
      repair.status = "doing";
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-remove-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      const [repairId, quoteId] = button.dataset.removeQuote.split(":");
      const repair = findRepair(repairId);
      if (!repair || repair.activeQuoteId) return;
      repair.quotes = repair.quotes.filter((quote) => quote.id !== quoteId);
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-toggle-complete]").forEach((button) => {
    button.addEventListener("click", () => togglePanelForm(button.dataset.toggleComplete, "complete"));
  });

  document.querySelectorAll("[data-toggle-terminate]").forEach((button) => {
    button.addEventListener("click", () => togglePanelForm(button.dataset.toggleTerminate, "terminate"));
  });

  // 完工验收：实付费用与验收结论必填，超承诺费用须填超支原因，缺项保持原状态
  document.querySelectorAll("[data-complete-form]").forEach((form) => {
    const sync = () => syncCompleteForm(form);
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const repair = findRepair(form.dataset.completeForm);
      if (!repair) return;
      const quote = activeQuote(repair);
      if (!quote) return;
      const data = Object.fromEntries(new FormData(form));
      const actualRaw = (data.actualCost || "").trim();
      const conclusion = data.conclusion;
      const overrunReason = (data.overrunReason || "").trim();
      const rectification = (data.rectification || "").trim();

      if (actualRaw === "" || Number.isNaN(Number(actualRaw)) || Number(actualRaw) < 0) {
        return showError(form, "请填写实付费用");
      }
      const actualCost = Number(actualRaw);
      if (!conclusion) return showError(form, "请选择验收结论");
      if (actualCost > Number(quote.promisedCost) && !overrunReason) {
        return showError(form, "实付超出承诺费用，请填写超支原因");
      }
      if (conclusion === "returned" && !rectification) {
        return showError(form, "验收退回需填写整改说明");
      }

      if (conclusion === "returned") {
        // 验收退回：记录整改说明，事项继续处理中，报价保持锁定
        repair.rectifications.push({ note: rectification, actualCost, at: new Date().toISOString() });
      } else {
        const now = new Date().toISOString();
        repair.completion = {
          actualCost,
          overrunReason,
          completedAt: now,
          contractor: quote.contractor,
          promisedCost: Number(quote.promisedCost),
          visitDate: quote.visitDate,
          warrantyDays: Number(quote.warrantyDays)
        };
        repair.quoteHistory.push({ ...quote, outcome: "completed", reason: "", closedAt: now });
        repair.activeQuoteId = null;
        repair.status = "done";
      }
      saveState();
      render();
    });
  });

  // 终止报价：须填原因，释放当前报价但保留历史，事项回到待处理
  document.querySelectorAll("[data-terminate-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const repair = findRepair(form.dataset.terminateForm);
      if (!repair) return;
      const quote = activeQuote(repair);
      if (!quote) return;
      const reason = (Object.fromEntries(new FormData(form)).reason || "").trim();
      if (!reason) return showError(form, "请填写终止原因");
      repair.quoteHistory.push({ ...quote, outcome: "terminated", reason, closedAt: new Date().toISOString() });
      repair.activeQuoteId = null;
      repair.status = "todo";
      saveState();
      render();
    });
  });
}

function togglePanelForm(repairId, kind) {
  const completeForm = document.querySelector(`[data-complete-form="${repairId}"]`);
  const terminateForm = document.querySelector(`[data-terminate-form="${repairId}"]`);
  if (!completeForm || !terminateForm) return;
  if (kind === "complete") {
    terminateForm.hidden = true;
    completeForm.hidden = !completeForm.hidden;
  } else {
    completeForm.hidden = true;
    terminateForm.hidden = !terminateForm.hidden;
  }
}

function syncCompleteForm(form) {
  const promised = Number(form.dataset.promised);
  const actualRaw = form.elements.actualCost.value.trim();
  const overrun = form.querySelector("[data-overrun]");
  const rectification = form.querySelector("[data-rectification]");
  overrun.hidden = !(actualRaw !== "" && !Number.isNaN(Number(actualRaw)) && Number(actualRaw) > promised);
  rectification.hidden = form.elements.conclusion.value !== "returned";
}

function validateQuoteInput(data) {
  if (!(data.contractor || "").trim()) return "请填写施工方";
  const cost = (data.promisedCost || "").trim();
  if (cost === "" || Number.isNaN(Number(cost)) || Number(cost) < 0) return "请填写承诺费用";
  if (!(data.visitDate || "").trim()) return "请选择上门日期";
  const warranty = (data.warrantyDays || "").trim();
  if (warranty === "" || Number.isNaN(Number(warranty)) || Number(warranty) < 0) return "请填写保修天数";
  return "";
}

function isQuoteComplete(quote) {
  if (!quote) return false;
  const hasContractor = Boolean(String(quote.contractor || "").trim());
  const hasCost = quote.promisedCost !== "" && quote.promisedCost !== null && quote.promisedCost !== undefined && !Number.isNaN(Number(quote.promisedCost)) && Number(quote.promisedCost) >= 0;
  const hasVisitDate = Boolean(String(quote.visitDate || "").trim());
  const hasWarranty = quote.warrantyDays !== "" && quote.warrantyDays !== null && quote.warrantyDays !== undefined && !Number.isNaN(Number(quote.warrantyDays)) && Number(quote.warrantyDays) >= 0;
  return hasContractor && hasCost && hasVisitDate && hasWarranty;
}

function showError(container, message) {
  const target = container && container.querySelector("[data-error]");
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
}

function fmtDate(iso) {
  return String(iso || "").slice(0, 10);
}

function filteredRepairs() {
  if (state.filter === "all") return state.repairs;
  return state.repairs.filter((repair) => repair.status === state.filter);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
