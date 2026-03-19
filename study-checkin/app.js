const STORAGE_KEY = "study-checkin.v1";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function parseISODate(iso) {
  // Avoid timezone surprises by constructing local date at noon.
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { entries: {} };
  const parsed = safeJsonParse(raw);
  if (!parsed.ok || typeof parsed.value !== "object" || !parsed.value) return { entries: {} };
  const entries = parsed.value.entries && typeof parsed.value.entries === "object" ? parsed.value.entries : {};
  return { entries };
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries: state.entries }));
}

function normalizeTags(str) {
  return String(str || "")
    .split(/[,\uFF0C]/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function computeStreak(entries) {
  const todayIso = toISODate(new Date());
  const hasToday = Boolean(entries[todayIso]);
  let streak = 0;
  let cursor = parseISODate(hasToday ? todayIso : toISODate(addDays(new Date(), -1)));

  while (true) {
    const iso = toISODate(cursor);
    if (!entries[iso]) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function countMonth(entries, monthDate) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  let count = 0;
  for (const iso of Object.keys(entries)) {
    const d = parseISODate(iso);
    if (d >= start && d <= end) count += 1;
  }
  return count;
}

function sortIsosDesc(isos) {
  return isos.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
}

function formatReadable(iso) {
  const d = parseISODate(iso);
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${iso}（周${week}）`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setStatus(el, msg) {
  el.textContent = msg;
  if (!msg) return;
  window.clearTimeout(setStatus._t);
  setStatus._t = window.setTimeout(() => {
    el.textContent = "";
  }, 2200);
}

function buildCalendar(container, viewMonthDate, selectedIso, entries, onSelect) {
  container.innerHTML = "";
  const weekday = ["一", "二", "三", "四", "五", "六", "日"];
  for (const w of weekday) {
    const div = document.createElement("div");
    div.className = "weekday";
    div.textContent = w;
    container.appendChild(div);
  }

  const first = startOfMonth(viewMonthDate);
  const last = endOfMonth(viewMonthDate);

  // Convert Sunday=0... to Monday-based index.
  const firstWeekday = (first.getDay() + 6) % 7; // 0 for Monday
  const gridStart = addDays(first, -firstWeekday);
  const totalCells = 42; // 6 weeks

  for (let i = 0; i < totalCells; i++) {
    const d = addDays(gridStart, i);
    const iso = toISODate(d);
    const inMonth = d >= first && d <= last;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "day";
    if (!inMonth) btn.classList.add("out");
    if (entries[iso]) btn.classList.add("done");
    if (selectedIso === iso) btn.classList.add("selected");
    btn.textContent = String(d.getDate());
    btn.title = formatReadable(iso);
    btn.setAttribute("data-iso", iso);
    btn.addEventListener("click", () => onSelect(iso, true));
    container.appendChild(btn);
  }
}

function renderList(listEl, emptyEl, entries, selectedIso, query, onPick) {
  const q = String(query || "").trim().toLowerCase();
  const isos = sortIsosDesc(Object.keys(entries));
  const filtered = q
    ? isos.filter((iso) => {
        const e = entries[iso];
        const tags = (e.tags || []).join(" ").toLowerCase();
        const content = String(e.content || "").toLowerCase();
        return iso.includes(q) || tags.includes(q) || content.includes(q);
      })
    : isos;

  listEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyEl.style.display = "block";
    emptyEl.textContent = isos.length === 0 ? "还没有任何打卡记录。先从今天开始吧。" : "没有匹配到任何记录。";
    return;
  }
  emptyEl.style.display = "none";

  for (const iso of filtered) {
    const e = entries[iso];
    const item = document.createElement("div");
    item.className = "item";
    if (iso === selectedIso) item.style.borderColor = "rgba(124, 92, 255, 0.7)";

    const header = document.createElement("div");
    header.className = "itemHeader";

    const date = document.createElement("button");
    date.type = "button";
    date.className = "date";
    date.textContent = iso;
    date.style.border = "none";
    date.style.background = "transparent";
    date.style.color = "inherit";
    date.style.cursor = "pointer";
    date.title = "点击切换到该日期";
    date.addEventListener("click", () => onPick(iso));

    const meta = document.createElement("div");
    meta.className = "meta";

    if (Number(e.minutes) > 0) {
      const p = document.createElement("span");
      p.className = "pill";
      p.textContent = `${e.minutes} 分钟`;
      meta.appendChild(p);
    }
    if (Array.isArray(e.tags) && e.tags.length) {
      const p = document.createElement("span");
      p.className = "pill";
      p.textContent = e.tags.slice(0, 6).map((t) => `#${t}`).join(" ");
      meta.appendChild(p);
    }

    header.appendChild(date);
    header.appendChild(meta);

    const content = document.createElement("div");
    content.className = "content";
    content.textContent = String(e.content || "");

    item.appendChild(header);
    item.appendChild(content);
    listEl.appendChild(item);
  }
}

function main() {
  const state = loadState();

  const subtitle = document.getElementById("subtitle");
  const todayText = document.getElementById("todayText");
  const statStreak = document.getElementById("statStreak");
  const statMonth = document.getElementById("statMonth");
  const statTotal = document.getElementById("statTotal");

  const form = document.getElementById("checkinForm");
  const dateInput = document.getElementById("dateInput");
  const minutesInput = document.getElementById("minutesInput");
  const tagsInput = document.getElementById("tagsInput");
  const contentInput = document.getElementById("contentInput");
  const contentHint = document.getElementById("contentHint");
  const saveStatus = document.getElementById("saveStatus");
  const deleteBtn = document.getElementById("deleteBtn");
  const quickTodayBtn = document.getElementById("quickTodayBtn");

  const calendarTitle = document.getElementById("calendarTitle");
  const calendar = document.getElementById("calendar");
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");
  const jumpTodayBtn = document.getElementById("jumpTodayBtn");

  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const wipeBtn = document.getElementById("wipeBtn");

  const todayIso = toISODate(new Date());
  todayText.textContent = `今天：${formatReadable(todayIso)}`;
  subtitle.textContent = "轻量、离线、本地保存";

  let selectedIso = todayIso;
  let viewMonthDate = startOfMonth(parseISODate(todayIso));
  let query = "";

  function refreshStats() {
    statTotal.textContent = String(Object.keys(state.entries).length);
    statStreak.textContent = String(computeStreak(state.entries));
    statMonth.textContent = String(countMonth(state.entries, new Date()));
  }

  function refreshCalendar() {
    const y = viewMonthDate.getFullYear();
    const m = viewMonthDate.getMonth() + 1;
    calendarTitle.textContent = `${y}-${pad2(m)}`;
    buildCalendar(calendar, viewMonthDate, selectedIso, state.entries, (iso, alsoScroll) => {
      selectDate(iso);
      if (alsoScroll) contentInput.focus();
    });
  }

  function refreshList() {
    renderList(listEl, emptyEl, state.entries, selectedIso, query, (iso) => selectDate(iso));
  }

  function loadFormFor(iso) {
    dateInput.value = iso;
    const e = state.entries[iso];
    if (!e) {
      minutesInput.value = "";
      tagsInput.value = "";
      contentInput.value = "";
      contentHint.textContent = "0 / 500";
      deleteBtn.disabled = true;
      return;
    }
    minutesInput.value = e.minutes ? String(e.minutes) : "";
    tagsInput.value = Array.isArray(e.tags) ? e.tags.join(", ") : "";
    contentInput.value = String(e.content || "");
    contentHint.textContent = `${contentInput.value.length} / 500`;
    deleteBtn.disabled = false;
  }

  function selectDate(iso) {
    selectedIso = iso;
    const d = parseISODate(iso);
    viewMonthDate = startOfMonth(d);
    loadFormFor(iso);
    refreshCalendar();
    refreshList();
  }

  contentInput.addEventListener("input", () => {
    contentHint.textContent = `${contentInput.value.length} / 500`;
  });

  quickTodayBtn.addEventListener("click", () => {
    selectDate(todayIso);
    setStatus(saveStatus, "已切换到今天");
  });

  prevMonthBtn.addEventListener("click", () => {
    viewMonthDate = startOfMonth(new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() - 1, 1, 12));
    refreshCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    viewMonthDate = startOfMonth(new Date(viewMonthDate.getFullYear(), viewMonthDate.getMonth() + 1, 1, 12));
    refreshCalendar();
  });

  jumpTodayBtn.addEventListener("click", () => {
    viewMonthDate = startOfMonth(parseISODate(todayIso));
    refreshCalendar();
    selectDate(todayIso);
  });

  searchInput.addEventListener("input", () => {
    query = searchInput.value;
    refreshList();
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const iso = dateInput.value;
    const content = contentInput.value.trim();
    if (!iso) return;
    if (!content) {
      setStatus(saveStatus, "请先填写学习内容");
      contentInput.focus();
      return;
    }

    const minutesRaw = minutesInput.value;
    const minutes = minutesRaw ? Math.max(0, Math.min(24 * 60, Math.round(Number(minutesRaw)))) : 0;
    const tags = normalizeTags(tagsInput.value);

    state.entries[iso] = { content, minutes, tags, updatedAt: Date.now() };
    saveState(state);

    setStatus(saveStatus, "已保存");
    deleteBtn.disabled = false;
    refreshStats();
    refreshCalendar();
    refreshList();
  });

  deleteBtn.addEventListener("click", () => {
    const iso = dateInput.value;
    if (!iso || !state.entries[iso]) {
      setStatus(saveStatus, "该日无记录可删");
      return;
    }
    const ok = window.confirm(`确定删除 ${iso} 的打卡记录吗？此操作无法撤销。`);
    if (!ok) return;
    delete state.entries[iso];
    saveState(state);
    setStatus(saveStatus, "已删除");
    loadFormFor(iso);
    refreshStats();
    refreshCalendar();
    refreshList();
  });

  exportBtn.addEventListener("click", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: state.entries,
    };
    const name = `study-checkin-backup-${toISODate(new Date())}.json`;
    downloadText(name, JSON.stringify(payload, null, 2));
    setStatus(saveStatus, "已导出 JSON");
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files && importFile.files[0];
    importFile.value = "";
    if (!file) return;
    const text = await file.text();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
      setStatus(saveStatus, "导入失败：JSON 格式不正确");
      return;
    }
    const obj = parsed.value;
    const entries = obj && typeof obj === "object" ? obj.entries : null;
    if (!entries || typeof entries !== "object") {
      setStatus(saveStatus, "导入失败：缺少 entries 字段");
      return;
    }
    const merged = { ...state.entries };
    let imported = 0;
    for (const [iso, e] of Object.entries(entries)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
      if (!e || typeof e !== "object") continue;
      const content = String(e.content || "").trim();
      if (!content) continue;
      const minutes = Number(e.minutes) > 0 ? Math.round(Number(e.minutes)) : 0;
      const tags = Array.isArray(e.tags) ? normalizeTags(e.tags.join(", ")) : normalizeTags(e.tags);
      merged[iso] = { content, minutes, tags, updatedAt: Date.now() };
      imported += 1;
    }
    if (imported === 0) {
      setStatus(saveStatus, "没有可导入的有效记录");
      return;
    }
    state.entries = merged;
    saveState(state);
    setStatus(saveStatus, `已导入 ${imported} 条`);
    refreshStats();
    refreshCalendar();
    refreshList();
    loadFormFor(selectedIso);
  });

  wipeBtn.addEventListener("click", () => {
    const ok = window.confirm("确定清空所有本地打卡数据吗？建议先导出备份。");
    if (!ok) return;
    state.entries = {};
    saveState(state);
    setStatus(saveStatus, "已清空");
    refreshStats();
    refreshCalendar();
    refreshList();
    loadFormFor(selectedIso);
  });

  // Init
  refreshStats();
  selectDate(todayIso);
  refreshCalendar();
  refreshList();
}

document.addEventListener("DOMContentLoaded", main);

