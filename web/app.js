import { dashboardFromCsv, SHEET_CSV_URL } from "./data.mjs";

const state = {
  data: null,
  region: "combined",
  person: "ankit",
  lastCsv: null,
  refreshing: false,
  revealedCards: { ankit: false, tripti: false },
  revealedMonths: [false, false, false],
};

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const animations = new WeakMap();
const MASK = "••••••";

function eyeIcon(visible) {
  return visible
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 6.1A11.7 11.7 0 0 1 12 6c6.4 0 10 6 10 6a14.8 14.8 0 0 1-3 3.4M6.2 7.5C3.5 9.2 2 12 2 12s3.6 6 10 6c1.7 0 3.2-.4 4.5-1"/><path d="M4 4l16 16M10 10a2.8 2.8 0 0 0 4 4"/></svg>';
}

function updateEye(button, visible, label) {
  button.innerHTML = eyeIcon(visible);
  button.setAttribute("aria-pressed", String(visible));
  button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${label}`);
}

function maskMoney(element) {
  const animation = animations.get(element);
  if (animation) cancelAnimationFrame(animation);
  animations.delete(element);
  delete element.dataset.numericValue;
  element.textContent = MASK;
  element.classList.add("masked-value");
}

function formatMoney(value, currency, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(value);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(value)}%`;
}

function progress(actual, target) {
  return target > 0 ? (actual / target) * 100 : 0;
}

function animateMoney(element, next, currency, compact = true) {
  element.classList.remove("masked-value");
  const previous = animations.get(element);
  if (previous) cancelAnimationFrame(previous);
  const from = Number(element.dataset.numericValue || 0);
  element.dataset.numericValue = String(next);
  if (reducedMotion.matches || Math.abs(next - from) < 0.01) {
    element.textContent = formatMoney(next, currency, compact);
    return;
  }
  const start = performance.now();
  const duration = 720;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    element.textContent = formatMoney(from + (next - from) * eased, currency, compact);
    if (t < 1) animations.set(element, requestAnimationFrame(step));
    else animations.delete(element);
  };
  animations.set(element, requestAnimationFrame(step));
}

function levelLabel(percent) {
  if (percent >= 100) return "TARGET REACHED";
  if (percent >= 75) return "FINAL STRETCH";
  if (percent >= 50) return "HALFWAY THERE";
  if (percent >= 25) return "MOMENTUM BUILDING";
  return "THE JOURNEY BEGINS";
}

function setPill(text, kind) {
  const pill = $("connectionPill");
  pill.className = `connection-pill ${kind}`;
  pill.lastElementChild.textContent = text;
}

function renderCard(key, person, currency) {
  const percent = progress(person.q4Actual, person.q4Target);
  if (state.revealedCards[key]) animateMoney($(`${key}Actual`), person.q4Actual, currency, false);
  else maskMoney($(`${key}Actual`));
  updateEye(
    document.querySelector(`[data-card-eye="${key}"]`),
    state.revealedCards[key],
    `${person.name}'s Q4 net achieved amount`,
  );
  $(`${key}Target`).textContent = formatMoney(person.q4Target, currency, true);
  $(`${key}Percent`).textContent = formatPercent(percent);
  $(`${key}Level`).textContent = levelLabel(percent);
  $(`${key}Remaining`).textContent = person.q4Actual >= person.q4Target
    ? `${formatMoney(person.q4Actual - person.q4Target, currency, true)} over target`
    : `${formatMoney(person.q4Target - person.q4Actual, currency, true)} to target`;
  const card = $(`${key}Card`);
  const bar = $(`${key}Progress`);
  card.querySelector("[role='progressbar']").setAttribute("aria-valuenow", String(Math.min(100, Math.round(percent))));
  requestAnimationFrame(() => { bar.style.width = `${Math.min(100, Math.max(0, percent))}%`; });
  card.querySelectorAll("[data-milestone]").forEach((milestone) => {
    milestone.classList.toggle("achieved", percent >= Number(milestone.dataset.milestone));
  });
  $(`${key}LanePercent`).textContent = formatPercent(percent);
  requestAnimationFrame(() => {
    const distance = Math.min(100, Math.max(0, percent));
    $(`${key}Lane`).style.width = `${distance}%`;
    $(`${key}Marker`).style.left = `${distance}%`;
  });
}

function updateMonthRow(row, month, currency, index) {
  const visible = state.revealedMonths[index];
  const values = [month.target, month.payment, month.refund, month.actual];
  values.forEach((value, column) => {
    const cell = row.cells[column + 1];
    cell.textContent = visible ? formatMoney(value, currency) : MASK;
    cell.classList.toggle("masked-value", !visible);
  });
  updateEye(row.querySelector("[data-month-eye]"), visible, `${month.month} figures`);

  const group = $("monthChart").children[index];
  if (group) {
    const tooltipValues = group.querySelectorAll("[data-tooltip-value]");
    tooltipValues[0].textContent = visible ? formatMoney(month.target, currency) : MASK;
    tooltipValues[1].textContent = visible ? formatMoney(month.actual, currency) : MASK;
  }
}

function renderChart(person, currency) {
  const max = Math.max(1, ...person.months.flatMap((month) => [month.target, month.actual]));
  const chart = $("monthChart");
  chart.setAttribute("aria-label", `${person.name}: monthly target and net actual for October through December 2026`);
  chart.replaceChildren();
  const ledger = $("ledgerBody");
  ledger.replaceChildren();

  person.months.forEach((month, index) => {
    const group = document.createElement("div");
    group.className = "month-group";
    group.tabIndex = 0;
    const targetHeight = Math.max(0, (month.target / max) * 100);
    const actualHeight = Math.max(0, (month.actual / max) * 100);
    group.innerHTML = `
      <div class="month-heading"><span>${month.month}</span><span>${formatPercent(progress(month.actual, month.target))}</span></div>
      <div class="bar-area"><div class="bar target" aria-hidden="true"></div><div class="bar actual ${state.person === "tripti" ? "tripti" : ""} ${month.actual === 0 ? "zero" : ""}" aria-hidden="true"></div></div>
      <div class="bar-labels"><span>TARGET</span><span>ACTUAL</span></div>
      <div class="bar-tooltip" aria-hidden="true"><strong>${month.month} 2026</strong><span>Target: <span data-tooltip-value></span></span><span>Net actual: <span data-tooltip-value></span></span></div>`;
    chart.append(group);
    requestAnimationFrame(() => {
      group.querySelector(".bar.target").style.height = `${targetHeight}%`;
      group.querySelector(".bar.actual").style.height = `${actualHeight}%`;
    });

    const row = document.createElement("tr");
    row.id = `ledger-${month.monthKey}`;
    const monthCell = document.createElement("td");
    const monthLabel = document.createElement("span");
    monthLabel.textContent = month.month;
    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "eye-toggle month-eye";
    eye.dataset.monthEye = String(index);
    eye.setAttribute("aria-controls", row.id);
    monthCell.append(monthLabel, eye);
    row.append(monthCell);
    for (let column = 0; column < 4; column += 1) row.append(document.createElement("td"));
    ledger.append(row);
    updateMonthRow(row, month, currency, index);
  });
}

function resetReveals() {
  state.revealedCards.ankit = false;
  state.revealedCards.tripti = false;
  state.revealedMonths.fill(false);
}

function render() {
  if (!state.data) return;
  const section = state.data.sections[state.region];
  const { ankit, tripti } = section.people;
  const currency = section.currency;
  $("teamTargetLabel").textContent = `${section.label.toUpperCase()} Q4 TARGET`;
  animateMoney($("teamTarget"), ankit.q4Target + tripti.q4Target, currency);
  animateMoney($("teamActual"), ankit.q4Actual + tripti.q4Actual, currency, false);
  $("teamPercent").textContent = formatPercent(progress(
    ankit.q4Actual + tripti.q4Actual,
    ankit.q4Target + tripti.q4Target,
  ));
  renderCard("ankit", ankit, currency);
  renderCard("tripti", tripti, currency);
  $("chartCurrency").textContent = currency;
  renderChart(section.people[state.person], currency);
  document.querySelectorAll("[data-region]").forEach((button) => {
    const active = button.dataset.region === state.region;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-person-button]").forEach((button) => {
    const active = button.dataset.personButton === state.person;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    const response = await fetch(SHEET_CSV_URL, { cache: "no-store", mode: "cors" });
    if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
    const csv = await response.text();
    if (csv !== state.lastCsv) {
      const payload = dashboardFromCsv(csv);
      state.data = payload;
      state.lastCsv = csv;
      render();
    }
    const checkedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    $("sourceStatus").textContent = `Google Sheet checked ${checkedAt} · Auto-check every 30 sec`;
    setPill("SHEET LIVE", "connected");
    $("errorNotice").hidden = true;
  } catch (error) {
    setPill("SOURCE UNAVAILABLE", "error");
    const notice = $("errorNotice");
    notice.textContent = state.data
      ? `The Google Sheet could not be refreshed. Showing the last loaded figures. ${error.message}`
      : `The Google Sheet could not be loaded. ${error.message}`;
    notice.hidden = false;
  } finally {
    state.refreshing = false;
  }
}

document.querySelectorAll("[data-region]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.region !== button.dataset.region) resetReveals();
    state.region = button.dataset.region;
    render();
  });
});
document.querySelectorAll("[data-person-button]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.person !== button.dataset.personButton) resetReveals();
    state.person = button.dataset.personButton;
    render();
  });
});
document.querySelectorAll("[data-select-person]").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.person !== button.dataset.selectPerson) resetReveals();
    state.person = button.dataset.selectPerson;
    render();
    $("chartTitle").scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
  });
});

document.querySelectorAll("[data-card-eye]").forEach((button) => {
  const name = button.dataset.cardEye === "ankit" ? "Ankit Arora" : "Tripti Mandal";
  updateEye(button, false, `${name}'s Q4 net achieved amount`);
  button.addEventListener("click", () => {
    if (!state.data) return;
    const key = button.dataset.cardEye;
    state.revealedCards[key] = !state.revealedCards[key];
    const person = state.data.sections[state.region].people[key];
    const currency = state.data.sections[state.region].currency;
    if (state.revealedCards[key]) animateMoney($(`${key}Actual`), person.q4Actual, currency, false);
    else maskMoney($(`${key}Actual`));
    updateEye(button, state.revealedCards[key], `${person.name}'s Q4 net achieved amount`);
  });
});

$("ledgerBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-month-eye]");
  if (!button) return;
  const index = Number(button.dataset.monthEye);
  state.revealedMonths[index] = !state.revealedMonths[index];
  const section = state.data.sections[state.region];
  updateMonthRow(button.closest("tr"), section.people[state.person].months[index], section.currency, index);
});

refresh();
setInterval(refresh, 30_000);
