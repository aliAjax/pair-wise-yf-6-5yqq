import "./styles.css";

const STORAGE_KEY = "zfl-14-repairs";
const statuses = {
  all: "全部",
  todo: "待处理",
  doing: "处理中",
  done: "已完成",
  terminated: "已终止"
};

const priorities = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

const quoteStateLabels = {
  candidate: "候选",
  locked: "已锁定",
  released: "已释放"
};

let state = loadState();
// 仅用于本次页面会话的表单错误提示，不写入本地数据
const uiErrors = {};
const app = document.querySelector("#app");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    return {
      filter: parsed.filter || "all",
      repairs: Array.isArray(parsed.repairs) ? parsed.repairs.map(normalizeRepair) : []
    };
  }
  return {
    filter: "all",
    repairs: seedRepairs()
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 兼容旧版本数据：补齐报价、验收、终止与历史字段
function normalizeRepair(raw) {
  const repair = raw || {};
  return {
    id: repair.id || crypto.randomUUID(),
    location: repair.location || "",
    title: repair.title || "",
    priority: priorities[repair.priority] ? repair.priority : "medium",
    cost: Number(repair.cost || 0),
    status: ["todo", "doing", "done", "terminated"].includes(repair.status) ? repair.status : "todo",
    photo: repair.photo || "",
    note: repair.note || "",
    quotes: Array.isArray(repair.quotes)
      ? repair.quotes.map((quote) => ({
          id: quote.id || crypto.randomUUID(),
          contractor: String(quote.contractor || ""),
          promisedCost: Number(quote.promisedCost || 0),
          visitDate: String(quote.visitDate || ""),
          warrantyDays: Number(quote.warrantyDays || 0),
          state: ["candidate", "locked", "released"].includes(quote.state) ? quote.state : "candidate",
          createdAt: quote.createdAt || ""
        }))
      : [],
    lockedQuoteId: repair.lockedQuoteId || null,
    acceptance: repair.acceptance
      ? {
          actualCost: Number(repair.acceptance.actualCost || 0),
          overspendReason: repair.acceptance.overspendReason || null,
          at: repair.acceptance.at || ""
        }
      : null,
    termination: repair.termination
      ? { reason: String(repair.termination.reason || ""), at: repair.termination.at || "" }
      : null,
    history: Array.isArray(repair.history) ? repair.history : []
  };
}

function seedRepairs() {
  const kitchen = normalizeRepair({
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
        contractor: "安居维修队",
        promisedCost: 260,
        visitDate: "2026-09-22",
        warrantyDays: 30,
        state: "candidate",
        createdAt: "2026-09-20 09:10"
      },
      {
        id: crypto.randomUUID(),
        contractor: "快修张师傅",
        promisedCost: 200,
        visitDate: "2026-09-21",
        warrantyDays: 15,
        state: "candidate",
        createdAt: "2026-09-20 09:12"
      }
    ],
    history: []
  });

  const bathQuote = crypto.randomUUID();
  const bathroom = normalizeRepair({
    location: "卫生间",
    title: "门锁松动，关门卡顿",
    priority: "medium",
    cost: 150,
    status: "doing",
    photo: "",
    note: "晚饭前家中有人",
    quotes: [
      {
        id: crypto.randomUUID(),
        contractor: "社区便民点",
        promisedCost: 220,
        visitDate: "2026-09-20",
        warrantyDays: 7,
        state: "candidate",
        createdAt: "2026-09-18 16:20"
      },
      {
        id: bathQuote,
        contractor: "开锁王师傅",
        promisedCost: 180,
        visitDate: "2026-09-19",
        warrantyDays: 60,
        state: "locked",
        createdAt: "2026-09-18 16:40"
      }
    ],
    lockedQuoteId: bathQuote,
    history: [
      {
        id: crypto.randomUUID(),
        type: "locked",
        at: "2026-09-18 16:42",
        quoteId: bathQuote,
        contractor: "开锁王师傅",
        promisedCost: 180,
        visitDate: "2026-09-19",
        warrantyDays: 60
      }
    ]
  });

  const lightQuote = crypto.randomUUID();
  const bedroom = normalizeRepair({
    location: "主卧",
    title: "吸顶灯频闪需要更换",
    priority: "low",
    cost: 120,
    status: "done",
    photo: "",
    note: "已恢复正常",
    quotes: [
      {
        id: lightQuote,
        contractor: "李电工",
        promisedCost: 120,
        visitDate: "2026-09-10",
        warrantyDays: 90,
        state: "locked",
        createdAt: "2026-09-09 11:00"
      }
    ],
    lockedQuoteId: lightQuote,
    acceptance: {
      actualCost: 150,
      overspendReason: "旧线路老化，额外更换了一段电线",
      at: "2026-09-10 17:20"
    },
    history: [
      {
        id: crypto.randomUUID(),
        type: "locked",
        at: "2026-09-09 11:05",
        quoteId: lightQuote,
        contractor: "李电工",
        promisedCost: 120,
        visitDate: "2026-09-10",
        warrantyDays: 90
      },
      {
        id: crypto.randomUUID(),
        type: "accepted",
        at: "2026-09-10 17:20",
        actualCost: 150,
        overspendReason: "旧线路老化，额外更换了一段电线"
      }
    ]
  });

  return [bedroom, bathroom, kitchen];
}

function render() {
  const repairs = filteredRepairs();
  const stats = computeStats();

  app.innerHTML = `
    <main class="shell">
      <header class="header">
        <div>
          <p class="eyebrow">本地家庭维护台</p>
          <h1>家庭维修事项</h1>
        </div>
        <section class="stats">
          <div class="stat"><span>未完成</span><strong>${stats.active}</strong></div>
          <div class="stat"><span>处理中</span><strong>${stats.doing}</strong></div>
          <div class="stat"><span>承诺费用</span><strong>${money(stats.promised)}</strong></div>
          <div class="stat">
            <span>完工实付</span><strong>${money(stats.paid)}</strong>
            <small class="stat-sub ${stats.overspent > 0 ? "over" : ""}">超支 ${money(stats.overspent)}</small>
          </div>
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
            <button class="primary" type="submit">保存事项</button>
            <p class="hint">新事项默认为“待处理”，选定候选报价后进入“处理中”并锁定。</p>
          </form>
        </aside>

        <section>
          <div class="toolbar">
            ${Object.entries(statuses)
              .map(
                ([value, label]) =>
                  `<button class="seg ${state.filter === value ? "active" : ""}" data-filter="${value}">${label}</button>`
              )
              .join("")}
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
  return `
    <article class="repair">
      <div class="photo">${
        repair.photo
          ? `<img src="${escapeHtml(repair.photo)}" alt="${escapeHtml(repair.location)}维修照片">`
          : "未添加照片"
      }</div>
      <div class="content">
        <div class="row">
          <h3>${escapeHtml(repair.location)}</h3>
          <span class="priority ${repair.priority}">${priorities[repair.priority]}</span>
          <span class="status ${repair.status}">${statuses[repair.status]}</span>
        </div>
        <p>${escapeHtml(repair.title)}</p>
        <div class="row">
          <span class="chip">预计 ${money(repair.cost)}</span>
          <span class="chip">${escapeHtml(repair.note || "暂无备注")}</span>
        </div>
        ${renderWorkflow(repair)}
        ${renderHistory(repair)}
        <div class="actions">
          <button class="ghost btn-sm" data-delete="${repair.id}">删除事项</button>
        </div>
      </div>
    </article>
  `;
}

function renderWorkflow(repair) {
  if (repair.status === "done") {
    return renderDonePanel(repair) + renderQuoteLedger(repair);
  }
  if (repair.status === "terminated") {
    return renderTerminatedPanel(repair) + renderQuoteLedger(repair);
  }
  if (getLockedQuote(repair)) {
    return renderLockedWorkflow(repair);
  }
  return renderQuotePicker(repair);
}

function renderQuotePicker(repair) {
  return `
    <div class="workflow-block">
      ${renderError(repair.id)}
      <h4>候选报价</h4>
      <ul class="quotes">
        ${
          repair.quotes.length
            ? repair.quotes
                .map(
                  (quote) => `
            <li class="quote-card">
              <div class="meta">
                <strong>${escapeHtml(quote.contractor)}</strong>
                <span class="chip">承诺 ${money(quote.promisedCost)}</span>
                <span class="chip">上门 ${escapeHtml(quote.visitDate)}</span>
                <span class="chip">保修 ${quote.warrantyDays} 天</span>
              </div>
              <button type="button" class="ghost btn-sm" data-lock-quote="${repair.id}" data-quote="${quote.id}">选定此报价</button>
            </li>`
                )
                .join("")
            : `<li class="hint">暂无候选报价，请先完整填写下方报价信息。</li>`
        }
      </ul>
      <form class="mini-form" novalidate data-add-quote="${repair.id}">
        <label>施工方<input name="contractor" placeholder="例如 安居维修队"></label>
        <div class="mini-grid">
          <label>承诺费用（元）<input name="cost" type="number" min="0" step="1" placeholder="260"></label>
          <label>保修天数（天）<input name="warrantyDays" type="number" min="0" step="1" placeholder="30"></label>
        </div>
        <label>上门日期<input name="visitDate" type="date"></label>
        <button class="primary btn-sm" type="submit">添加候选报价</button>
        <p class="hint">施工方、承诺费用、上门日期、保修天数缺一不可；缺项将整次拒绝，已有报价与事项状态保持不变。</p>
      </form>
    </div>
  `;
}

function renderLockedWorkflow(repair) {
  const quote = getLockedQuote(repair);
  return `
    <div class="workflow-block">
      ${renderError(repair.id)}
      <div class="summary summary-locked">
        <h4>已锁定报价 · 处理中 <span class="tag locked">报价已锁定</span></h4>
        <div class="kv">
          <span class="chip">施工方 ${escapeHtml(quote.contractor)}</span>
          <span class="chip">承诺 ${money(quote.promisedCost)}</span>
          <span class="chip">上门 ${escapeHtml(quote.visitDate)}</span>
          <span class="chip">保修 ${quote.warrantyDays} 天</span>
        </div>
      </div>

      <form class="mini-form acceptance-form" novalidate data-acceptance="${repair.id}">
        <h4>完工验收</h4>
        <div class="mini-grid">
          <label>实付费用（元）<input name="actualCost" type="number" min="0" step="1" placeholder="0"></label>
          <label>验收结论
            <select name="conclusion">
              <option value="">请选择结论</option>
              <option value="pass">验收通过（完工）</option>
              <option value="return">验收退回（整改）</option>
            </select>
          </label>
        </div>
        <label>超支原因<textarea name="overspendReason" placeholder="实付超过承诺费用 ${money(
          quote.promisedCost
        )} 时必填"></textarea></label>
        <div class="rectification-wrap" hidden>
          <label>整改说明<textarea name="rectificationNote" placeholder="验收退回时必填，提交后记录整改说明并继续处理中"></textarea></label>
        </div>
        <button class="primary btn-sm" type="submit">提交验收</button>
        <p class="hint">实付费用、验收结论必填；超承诺费用须填超支原因；验收退回须填整改说明。任一项缺失均保持“处理中”状态。</p>
      </form>

      <div class="terminate">
        <button type="button" class="danger-ghost btn-sm" data-terminate-toggle="${repair.id}">终止事项</button>
        <form class="mini-form terminate-form" hidden novalidate data-terminate="${repair.id}">
          <label>终止原因<textarea name="reason" placeholder="必填；确认后释放当前报价，报价与处理历史仍会保留"></textarea></label>
          <div class="actions">
            <button class="danger btn-sm" type="submit">确认终止并释放报价</button>
            <button type="button" class="ghost btn-sm" data-terminate-cancel="${repair.id}">取消</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderDonePanel(repair) {
  const quote = getLockedQuote(repair);
  const acceptance = repair.acceptance;
  if (!acceptance) {
    return `<div class="summary summary-done"><h4>已完成</h4><p class="hint">该事项为历史数据，缺少验收记录。</p></div>`;
  }
  const over = quote && acceptance.actualCost > quote.promisedCost;
  const warrantyEnd = quote ? addDays(quote.visitDate, quote.warrantyDays) : "";
  return `
    <div class="summary summary-done">
      <h4>✓ 验收通过 · 已完工</h4>
      <div class="kv">
        ${quote ? `<span class="chip">施工方 ${escapeHtml(quote.contractor)}</span>` : ""}
        ${quote ? `<span class="chip">承诺 ${money(quote.promisedCost)}</span>` : ""}
        <span class="chip">实付 <em class="${over ? "over" : ""}">${money(acceptance.actualCost)}</em></span>
        ${over ? `<span class="chip over">超支 ${money(acceptance.actualCost - quote.promisedCost)}</span>` : ""}
        ${quote ? `<span class="chip">上门 ${escapeHtml(quote.visitDate)}</span>` : ""}
        ${
          quote
            ? `<span class="chip">保修 ${quote.warrantyDays} 天${warrantyEnd ? `（保修至 ${warrantyEnd}）` : ""}</span>`
            : ""
        }
        <span class="chip">验收时间 ${escapeHtml(acceptance.at)}</span>
      </div>
      ${acceptance.overspendReason ? `<p class="reason">超支原因：${escapeHtml(acceptance.overspendReason)}</p>` : ""}
    </div>
  `;
}

function renderTerminatedPanel(repair) {
  const released = repair.quotes.filter((quote) => quote.state === "released").at(-1);
  return `
    <div class="summary summary-terminated">
      <h4>已终止 <span class="tag released">报价已释放</span></h4>
      <p class="reason">终止原因：${escapeHtml(repair.termination?.reason || "未记录")}</p>
      ${
        released
          ? `<p class="hint">释放的报价：${escapeHtml(released.contractor)}，承诺 ${money(
              released.promisedCost
            )}，上门 ${escapeHtml(released.visitDate)}，保修 ${released.warrantyDays} 天（报价与历史均保留）。</p>`
          : `<p class="hint">当前没有被释放的锁定报价。</p>`
      }
      <p class="hint">终止时间：${escapeHtml(repair.termination?.at || "")}</p>
    </div>
  `;
}

// 已结束事项（完工/终止）只读展示全部报价记录，体现“保留历史”
function renderQuoteLedger(repair) {
  if (!repair.quotes.length) return "";
  return `
    <div class="ledger">
      <h4>报价记录</h4>
      <ul class="quotes">
        ${repair.quotes
          .map(
            (quote) => `
          <li class="quote-card readonly">
            <div class="meta">
              <strong>${escapeHtml(quote.contractor)}</strong>
              <span class="chip">承诺 ${money(quote.promisedCost)}</span>
              <span class="chip">上门 ${escapeHtml(quote.visitDate)}</span>
              <span class="chip">保修 ${quote.warrantyDays} 天</span>
            </div>
            <span class="tag ${quote.state}">${quoteStateLabels[quote.state]}</span>
          </li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function renderHistory(repair) {
  if (!repair.history.length) return "";
  return `
    <div class="history-block">
      <h4>处理历史</h4>
      <ul class="history">
        ${repair.history.map(renderHistoryEvent).join("")}
      </ul>
    </div>
  `;
}

function renderHistoryEvent(event) {
  let text;
  if (event.type === "locked") {
    text = `锁定报价：${escapeHtml(event.contractor)}，承诺 ${money(
      event.promisedCost
    )}，上门 ${escapeHtml(event.visitDate)}，保修 ${event.warrantyDays} 天，事项转为处理中`;
  } else if (event.type === "accepted") {
    text = `验收通过，事项完工：实付 ${money(event.actualCost)}${
      event.overspendReason ? `；超支原因：${escapeHtml(event.overspendReason)}` : ""
    }`;
  } else if (event.type === "returned") {
    text = `验收退回，继续处理中：实付填报 ${money(event.actualCost)}；整改说明：${escapeHtml(
      event.rectificationNote
    )}${event.overspendReason ? `；超支情况：${escapeHtml(event.overspendReason)}` : ""}`;
  } else if (event.type === "terminated") {
    text = `终止事项：${escapeHtml(event.reason)}；已释放报价 ${escapeHtml(
      event.contractor || ""
    )}，历史保留`;
  } else {
    text = "状态更新";
  }
  return `<li><time>${escapeHtml(event.at || "")}</time>${text}</li>`;
}

function renderError(repairId) {
  return uiErrors[repairId] ? `<div class="alert" role="alert">${escapeHtml(uiErrors[repairId])}</div>` : "";
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

  document.querySelectorAll("form[data-add-quote]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      addQuote(form.dataset.addQuote, new FormData(form));
    });
  });

  document.querySelectorAll("[data-lock-quote]").forEach((button) => {
    button.addEventListener("click", () => {
      lockQuote(button.dataset.lockQuote, button.dataset.quote);
    });
  });

  document.querySelectorAll("form[data-acceptance]").forEach((form) => {
    const conclusion = form.querySelector("[name='conclusion']");
    const rectificationWrap = form.querySelector(".rectification-wrap");
    conclusion.addEventListener("change", () => {
      rectificationWrap.hidden = conclusion.value !== "return";
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitAcceptance(form.dataset.acceptance, new FormData(form));
    });
  });

  document.querySelectorAll("[data-terminate-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(`form[data-terminate="${button.dataset.terminateToggle}"]`);
      form.hidden = false;
      button.hidden = true;
      form.querySelector("[name='reason']").focus();
    });
  });

  document.querySelectorAll("[data-terminate-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector(`form[data-terminate="${button.dataset.terminateCancel}"]`);
      form.hidden = true;
      document.querySelector(`[data-terminate-toggle="${button.dataset.terminateCancel}"]`).hidden = false;
    });
  });

  document.querySelectorAll("form[data-terminate]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      terminateRepair(form.dataset.terminate, new FormData(form));
    });
  });

  document.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.repairs = state.repairs.filter((repair) => repair.id !== button.dataset.delete);
      delete uiErrors[button.dataset.delete];
      saveState();
      render();
    });
  });
}

// 新增候选报价：四项缺一即整次拒绝，原报价和状态不变
function addQuote(repairId, formData) {
  const repair = state.repairs.find((item) => item.id === repairId);
  if (!repair || isClosed(repair) || repair.lockedQuoteId) {
    flashError(repairId, "当前事项已锁定或已结束，不能再添加候选报价。");
    return;
  }

  const contractor = String(formData.get("contractor") || "").trim();
  const costRaw = String(formData.get("cost") || "").trim();
  const visitDate = String(formData.get("visitDate") || "").trim();
  const warrantyRaw = String(formData.get("warrantyDays") || "").trim();

  const missing = [];
  if (!contractor) missing.push("施工方");
  if (!isMoney(costRaw)) missing.push("承诺费用");
  if (!isValidDate(visitDate)) missing.push("上门日期");
  if (!isIntegerAmount(warrantyRaw)) missing.push("保修天数");

  if (missing.length) {
    // 整次拒绝：不写入任何报价，状态保持不变
    flashError(repairId, `候选报价缺少${missing.join("、")}，本次提交已整次拒绝，原报价与事项状态不变。`);
    return;
  }

  repair.quotes.push({
    id: crypto.randomUUID(),
    contractor,
    promisedCost: Number(costRaw),
    visitDate,
    warrantyDays: Number(warrantyRaw),
    state: "candidate",
    createdAt: nowText()
  });
  clearError(repairId);
  saveState();
  render();
}

// 选定候选报价：事项转为处理中并锁定，之后只能走验收或终止
function lockQuote(repairId, quoteId) {
  const repair = state.repairs.find((item) => item.id === repairId);
  const quote = repair?.quotes.find((item) => item.id === quoteId);
  if (!repair || !quote || isClosed(repair) || repair.lockedQuoteId) {
    flashError(repairId, "当前报价无法选定。");
    return;
  }
  if (!isQuoteComplete(quote)) {
    flashError(repairId, "该报价信息不完整，不能锁定。");
    return;
  }

  quote.state = "locked";
  repair.lockedQuoteId = quote.id;
  repair.status = "doing";
  pushHistory(repair, {
    type: "locked",
    at: nowText(),
    quoteId: quote.id,
    contractor: quote.contractor,
    promisedCost: quote.promisedCost,
    visitDate: quote.visitDate,
    warrantyDays: quote.warrantyDays
  });
  clearError(repairId);
  saveState();
  render();
}

// 完工验收：实付费用 + 验收结论必填；超承诺费用须填超支原因；退回须填整改说明并继续处理中
function submitAcceptance(repairId, formData) {
  const repair = state.repairs.find((item) => item.id === repairId);
  const quote = getLockedQuote(repair);
  if (!repair || !quote) {
    flashError(repairId, "未找到锁定报价，无法提交验收。");
    return;
  }

  const actualRaw = String(formData.get("actualCost") || "").trim();
  const conclusion = String(formData.get("conclusion") || "").trim();
  const overspendReason = String(formData.get("overspendReason") || "").trim();
  const rectificationNote = String(formData.get("rectificationNote") || "").trim();

  const missing = [];
  let actualCost = 0;
  if (!isMoney(actualRaw)) {
    missing.push("实付费用");
  } else {
    actualCost = Number(actualRaw);
  }
  if (conclusion !== "pass" && conclusion !== "return") missing.push("验收结论");
  if (isMoney(actualRaw) && actualCost > quote.promisedCost && !overspendReason) {
    missing.push(`超支原因（实付已超过承诺费用 ${money(quote.promisedCost)}）`);
  }
  if (conclusion === "return" && !rectificationNote) missing.push("整改说明");

  if (missing.length) {
    // 缺项：本次提交作废，事项保持原状态（处理中）
    flashError(repairId, `验收信息缺少${missing.join("、")}，本次提交无效，事项保持“处理中”。`);
    return;
  }

  if (conclusion === "pass") {
    repair.status = "done";
    repair.acceptance = {
      actualCost,
      overspendReason: overspendReason || null,
      at: nowText()
    };
    pushHistory(repair, {
      type: "accepted",
      at: repair.acceptance.at,
      actualCost,
      overspendReason: overspendReason || null
    });
  } else {
    // 验收退回：记录整改说明，继续处理中，锁定报价不变
    repair.status = "doing";
    pushHistory(repair, {
      type: "returned",
      at: nowText(),
      actualCost,
      rectificationNote,
      overspendReason: overspendReason || null
    });
  }

  clearError(repairId);
  saveState();
  render();
}

// 终止：必填原因，释放当前锁定报价（报价不删除），保留全部历史
function terminateRepair(repairId, formData) {
  const repair = state.repairs.find((item) => item.id === repairId);
  const quote = getLockedQuote(repair);
  const reason = String(formData.get("reason") || "").trim();

  if (!repair || !quote) {
    flashError(repairId, "当前事项没有可释放的锁定报价。");
    return;
  }
  if (!reason) {
    flashError(repairId, "请填写终止原因，否则不会释放当前报价。");
    return;
  }

  const at = nowText();
  quote.state = "released";
  repair.lockedQuoteId = null;
  repair.status = "terminated";
  repair.termination = { reason, at };
  pushHistory(repair, {
    type: "terminated",
    at,
    reason,
    quoteId: quote.id,
    contractor: quote.contractor,
    promisedCost: quote.promisedCost,
    visitDate: quote.visitDate,
    warrantyDays: quote.warrantyDays
  });

  clearError(repairId);
  saveState();
  render();
}

function computeStats() {
  const active = state.repairs.filter((repair) => repair.status === "todo" || repair.status === "doing");
  const promised = active.reduce((total, repair) => {
    const quote = getLockedQuote(repair);
    return total + (quote ? Number(quote.promisedCost || 0) : 0);
  }, 0);
  const done = state.repairs.filter((repair) => repair.status === "done");
  const paid = done.reduce(
    (total, repair) => total + Number(repair.acceptance?.actualCost || 0),
    0
  );
  const overspent = done.reduce((total, repair) => {
    const quote = getLockedQuote(repair);
    const actual = Number(repair.acceptance?.actualCost);
    if (quote && Number.isFinite(actual) && actual > quote.promisedCost) {
      return total + (actual - quote.promisedCost);
    }
    return total;
  }, 0);
  return {
    active: active.length,
    doing: state.repairs.filter((repair) => repair.status === "doing").length,
    promised,
    paid,
    overspent
  };
}

function getLockedQuote(repair) {
  if (!repair || !repair.lockedQuoteId) return null;
  return repair.quotes.find((quote) => quote.id === repair.lockedQuoteId) || null;
}

function isClosed(repair) {
  return repair.status === "done" || repair.status === "terminated";
}

function isQuoteComplete(quote) {
  return (
    quote &&
    String(quote.contractor || "").trim() !== "" &&
    Number.isFinite(Number(quote.promisedCost)) &&
    Number(quote.promisedCost) >= 0 &&
    isValidDate(quote.visitDate) &&
    Number.isInteger(Number(quote.warrantyDays)) &&
    Number(quote.warrantyDays) >= 0
  );
}

function isMoney(value) {
  if (value === "" || value === null || value === undefined) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function isIntegerAmount(value) {
  if (value === "" || value === null || value === undefined) return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function addDays(isoDate, days) {
  if (!isValidDate(isoDate)) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function pushHistory(repair, event) {
  repair.history.push({ id: crypto.randomUUID(), ...event });
}

function flashError(repairId, message) {
  if (!repairId) return;
  uiErrors[repairId] = message;
  render();
}

function clearError(repairId) {
  delete uiErrors[repairId];
}

function filteredRepairs() {
  if (state.filter === "all") return state.repairs;
  return state.repairs.filter((repair) => repair.status === state.filter);
}

function money(value) {
  return `¥${Number(value || 0)}`;
}

function nowText() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

render();
