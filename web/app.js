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
const MASK = "••••••";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

function setPill(text, kind) {
  const pill = $("connectionPill");
  pill.className = `connection-pill ${kind}`;
  pill.lastElementChild.textContent = text;
}

function resetReveals() {
  state.revealedCards.ankit = false;
  state.revealedCards.tripti = false;
  state.revealedMonths.fill(false);
}

function renderCard(key, person, currency) {
  const percent = progress(person.q4Actual, person.q4Target);
  const amount = $(`${key}Actual`);
  amount.textContent = state.revealedCards[key] ? formatMoney(person.q4Actual, currency) : MASK;
  amount.classList.toggle("masked-value", !state.revealedCards[key]);
  updateEye(document.querySelector(`[data-card-eye="${key}"]`), state.revealedCards[key], `${person.name}'s Q4 net achieved amount`);
  $(`${key}Target`).textContent = formatMoney(person.q4Target, currency, true);
  $(`${key}Percent`).textContent = formatPercent(percent);
  $(`${key}Remaining`).textContent = person.q4Actual >= person.q4Target
    ? `${formatMoney(person.q4Actual - person.q4Target, currency, true)} over target`
    : `${formatMoney(person.q4Target - person.q4Actual, currency, true)} to target`;
  const track = $(`${key}Card`).querySelector("[role='progressbar']");
  track.setAttribute("aria-valuenow", String(Math.min(100, Math.max(0, Math.round(percent)))));
  requestAnimationFrame(() => { $(`${key}Progress`).style.width = `${Math.min(100, Math.max(0, percent))}%`; });
}

function renderComparison(ankit, tripti) {
  const ankitPercent = progress(ankit.q4Actual, ankit.q4Target);
  const triptiPercent = progress(tripti.q4Actual, tripti.q4Target);
  const difference = Math.abs(ankitPercent - triptiPercent);
  if (ankitPercent === 0 && triptiPercent === 0) {
    $("leaderSummary").textContent = "No leader yet";
    $("leaderScore").textContent = "Both at 0% of target";
  } else if (difference < 0.05) {
    $("leaderSummary").textContent = "Ankit and Tripti are tied";
    $("leaderScore").textContent = `${formatPercent(ankitPercent)} of target each`;
  } else {
    const leader = ankitPercent > triptiPercent ? "Ankit" : "Tripti";
    $("leaderSummary").textContent = `${leader} is leading`;
    $("leaderScore").textContent = `${formatPercent(Math.max(ankitPercent, triptiPercent))} vs ${formatPercent(Math.min(ankitPercent, triptiPercent))} · ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(difference)} pts ahead`;
  }
}

function updateMonthRow(row, month, currency, index) {
  const visible = state.revealedMonths[index];
  [month.target, month.payment, month.refund, month.actual].forEach((value, column) => {
    const cell = row.cells[column + 1];
    cell.textContent = visible ? formatMoney(value, currency) : MASK;
    cell.classList.toggle("masked-value", !visible);
  });
  updateEye(row.querySelector("[data-month-eye]"), visible, `${month.month} figures`);
}

function renderLedger(person, currency) {
  const ledger = $("ledgerBody");
  ledger.replaceChildren();
  person.months.forEach((month, index) => {
    const row = document.createElement("tr");
    row.id = `ledger-${month.monthKey}`;
    const monthCell = document.createElement("th");
    monthCell.scope = "row";
    const label = document.createElement("span");
    label.textContent = month.month;
    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "eye-toggle month-eye";
    eye.dataset.monthEye = String(index);
    eye.setAttribute("aria-controls", row.id);
    monthCell.append(label, eye);
    row.append(monthCell);
    for (let column = 0; column < 4; column += 1) row.append(document.createElement("td"));
    ledger.append(row);
    updateMonthRow(row, month, currency, index);
  });
}

function render() {
  if (!state.data) return;
  const section = state.data.sections[state.region];
  const { ankit, tripti } = section.people;
  renderComparison(ankit, tripti);
  renderCard("ankit", ankit, section.currency);
  renderCard("tripti", tripti, section.currency);
  $("chartCurrency").textContent = section.currency;
  renderLedger(section.people[state.person], section.currency);
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
      state.data = dashboardFromCsv(csv);
      state.lastCsv = csv;
      render();
    }
    const checkedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    $("sourceStatus").textContent = `Google Sheet checked ${checkedAt} · Auto-check every 30 sec`;
    setPill("Sheet live", "connected");
    $("errorNotice").hidden = true;
  } catch (error) {
    setPill("Source unavailable", "error");
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
    $("monthlyTitle").scrollIntoView({ behavior: reducedMotion.matches ? "instant" : "smooth", block: "start" });
  });
});
document.querySelectorAll("[data-card-eye]").forEach((button) => {
  const name = button.dataset.cardEye === "ankit" ? "Ankit Arora" : "Tripti Mandal";
  updateEye(button, false, `${name}'s Q4 net achieved amount`);
  button.addEventListener("click", () => {
    if (!state.data) return;
    const key = button.dataset.cardEye;
    state.revealedCards[key] = !state.revealedCards[key];
    const section = state.data.sections[state.region];
    renderCard(key, section.people[key], section.currency);
  });
});
$("ledgerBody").addEventListener("click", (event) => {
  const button = event.target.closest("[data-month-eye]");
  if (!button || !state.data) return;
  const index = Number(button.dataset.monthEye);
  state.revealedMonths[index] = !state.revealedMonths[index];
  const section = state.data.sections[state.region];
  updateMonthRow(button.closest("tr"), section.people[state.person].months[index], section.currency, index);
});

refresh();
setInterval(refresh, 30_000);
