const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_CYCLES = new Map([
  ["monthly", 1],
  ["quarterly", 3],
  ["yearly", 12],
  ["biennial", 24],
]);
const DAY_CYCLES = new Map([["weekly", 7]]);
const CSV_HEADER = [
  "id",
  "name",
  "amount",
  "currency",
  "cycle",
  "anchor",
  "category",
  "active",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidCycle(cycle) {
  return (
    MONTH_CYCLES.has(cycle) ||
    DAY_CYCLES.has(cycle) ||
    (isObject(cycle) && Number.isFinite(cycle.days) && cycle.days > 0)
  );
}

function daysForCycle(cycle) {
  if (DAY_CYCLES.has(cycle)) return DAY_CYCLES.get(cycle);
  if (isObject(cycle) && Number.isFinite(cycle.days) && cycle.days > 0) {
    return cycle.days;
  }
  return null;
}

function monthsForCycle(cycle) {
  return MONTH_CYCLES.get(cycle) ?? null;
}

function parseISODate(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new TypeError(`Invalid ISO date: ${iso}`);
  }
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid ISO date: ${iso}`);
  }
  return date;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function addMonthsFromAnchor(anchor, monthsToAdd) {
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();
  const anchorDay = anchor.getUTCDate();
  const absoluteMonth = anchorYear * 12 + anchorMonth + monthsToAdd;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth % 12;
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

function requireRate(currency, fx) {
  if (!isObject(fx) || !Object.prototype.hasOwnProperty.call(fx, currency)) {
    throw new RangeError(`Missing FX rate for ${currency}`);
  }
  const rate = fx[currency];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`Invalid FX rate for ${currency}`);
  }
  return rate;
}

function activeSubs(subs) {
  return Array.isArray(subs) ? subs.filter((sub) => sub && sub.active === true) : [];
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  if (rows.length === 1 && rows[0].length === 1 && rows[0][0] === "") return [];
  return rows;
}

function cycleToCSV(cycle) {
  return typeof cycle === "string" ? cycle : JSON.stringify(cycle);
}

function cycleFromCSV(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("{")) return JSON.parse(text);
  return text;
}

export function monthlyAmount(sub) {
  const amount = Number(sub?.amount);
  if (!Number.isFinite(amount)) {
    throw new TypeError("Subscription amount must be a finite number");
  }
  const cycle = sub?.cycle;
  if (cycle === "weekly") return (amount * 52) / 12;
  if (cycle === "monthly") return amount;
  if (cycle === "quarterly") return amount / 3;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "biennial") return amount / 24;
  if (isObject(cycle) && Number.isFinite(cycle.days) && cycle.days > 0) {
    return (amount * (365.25 / 12)) / cycle.days;
  }
  throw new TypeError(`Invalid billing cycle: ${JSON.stringify(cycle)}`);
}

export function yearlyAmount(sub) {
  return monthlyAmount(sub) * 12;
}

export function convert(amount, from, to, fx) {
  if (!Number.isFinite(amount)) {
    throw new TypeError("Amount must be a finite number");
  }
  const fromRate = requireRate(from, fx);
  const toRate = requireRate(to, fx);
  return (amount / fromRate) * toRate;
}

export function monthlyTotal(subs, displayCcy, fx) {
  return activeSubs(subs).reduce(
    (total, sub) => total + convert(monthlyAmount(sub), sub.currency, displayCcy, fx),
    0,
  );
}

export function yearlyTotal(subs, displayCcy, fx) {
  return activeSubs(subs).reduce(
    (total, sub) => total + convert(yearlyAmount(sub), sub.currency, displayCcy, fx),
    0,
  );
}

export function nextRenewal(sub, todayISO) {
  const anchor = parseISODate(sub?.anchor);
  const today = parseISODate(todayISO);
  if (anchor.getTime() >= today.getTime()) return toISODate(anchor);

  const dayStep = daysForCycle(sub?.cycle);
  if (dayStep !== null) {
    const elapsedDays = Math.floor((today.getTime() - anchor.getTime()) / MS_PER_DAY);
    const periods = Math.ceil(elapsedDays / dayStep);
    return toISODate(addDays(anchor, periods * dayStep));
  }

  const monthStep = monthsForCycle(sub?.cycle);
  if (monthStep !== null) {
    const monthDelta =
      (today.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
      (today.getUTCMonth() - anchor.getUTCMonth());
    let monthsToAdd = Math.max(0, Math.floor(monthDelta / monthStep) * monthStep);
    let candidate = addMonthsFromAnchor(anchor, monthsToAdd);
    while (candidate.getTime() < today.getTime()) {
      monthsToAdd += monthStep;
      candidate = addMonthsFromAnchor(anchor, monthsToAdd);
    }
    return toISODate(candidate);
  }

  throw new TypeError(`Invalid billing cycle: ${JSON.stringify(sub?.cycle)}`);
}

export function daysUntil(dateISO, todayISO) {
  const date = parseISODate(dateISO);
  const today = parseISODate(todayISO);
  return Math.floor((date.getTime() - today.getTime()) / MS_PER_DAY);
}

export function upcomingRenewals(subs, todayISO, withinDays) {
  if (!Number.isFinite(withinDays) || withinDays < 0) return [];
  return activeSubs(subs)
    .map((sub, index) => {
      const date = nextRenewal(sub, todayISO);
      return { sub, date, days: daysUntil(date, todayISO), index };
    })
    .filter((item) => item.days >= 0 && item.days <= withinDays)
    .sort((a, b) => a.days - b.days || a.index - b.index)
    .map(({ sub, date, days }) => ({ sub, date, days }));
}

export function breakdownByCategory(subs, displayCcy, fx) {
  const grouped = new Map();
  for (const sub of activeSubs(subs)) {
    const category = sub.category;
    const current = grouped.get(category) ?? {
      category,
      monthly: 0,
      yearly: 0,
      count: 0,
    };
    current.monthly += convert(monthlyAmount(sub), sub.currency, displayCcy, fx);
    current.yearly += convert(yearlyAmount(sub), sub.currency, displayCcy, fx);
    current.count += 1;
    grouped.set(category, current);
  }
  return [...grouped.values()].sort(
    (a, b) => b.monthly - a.monthly || String(a.category).localeCompare(String(b.category)),
  );
}

export function projectedSpend(subs, displayCcy, fx, months) {
  if (!Number.isFinite(months) || months <= 0) return 0;
  return monthlyTotal(subs, displayCcy, fx) * months;
}

export function toCSV(subs) {
  const rows = [CSV_HEADER.join(",")];
  for (const sub of Array.isArray(subs) ? subs : []) {
    rows.push(
      [
        sub.id,
        sub.name,
        sub.amount,
        sub.currency,
        cycleToCSV(sub.cycle),
        sub.anchor,
        sub.category,
        sub.active,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return rows.join("\n");
}

export function fromCSV(text) {
  const rows = parseCSV(String(text ?? ""));
  if (rows.length <= 1) return [];
  return rows.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
    const record = Object.fromEntries(CSV_HEADER.map((key, index) => [key, row[index] ?? ""]));
    return {
      id: record.id,
      name: record.name,
      amount: Number(record.amount),
      currency: record.currency,
      cycle: cycleFromCSV(record.cycle),
      anchor: record.anchor,
      category: record.category,
      active: /^true$/i.test(record.active),
    };
  });
}

export function toJSON(subs) {
  return JSON.stringify(Array.isArray(subs) ? subs : []);
}

export function fromJSON(text) {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function validateSub(obj) {
  const errors = [];
  if (!isObject(obj)) {
    return { ok: false, errors: ["subscription must be an object"] };
  }
  if (typeof obj.id !== "string" || obj.id.length === 0) errors.push("id must be a string");
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    errors.push("name must be a string");
  }
  if (!Number.isFinite(obj.amount) || obj.amount < 0) {
    errors.push("amount must be a finite number >= 0");
  }
  if (typeof obj.currency !== "string" || !/^[A-Z]{3,5}$/.test(obj.currency)) {
    errors.push("currency must be an uppercase ISO-like code");
  }
  if (!isValidCycle(obj.cycle)) errors.push("cycle must be supported");
  try {
    parseISODate(obj.anchor);
  } catch {
    errors.push("anchor must be a valid YYYY-MM-DD date");
  }
  if (typeof obj.category !== "string") errors.push("category must be a string");
  if (typeof obj.active !== "boolean") errors.push("active must be boolean");
  return { ok: errors.length === 0, errors };
}

export function summary(subs, displayCcy, fx) {
  const active = activeSubs(subs);
  let biggest = null;
  let biggestMonthly = -Infinity;
  for (const sub of active) {
    const convertedMonthly = convert(monthlyAmount(sub), sub.currency, displayCcy, fx);
    if (convertedMonthly > biggestMonthly) {
      biggestMonthly = convertedMonthly;
      biggest = sub;
    }
  }
  const breakdown = breakdownByCategory(subs, displayCcy, fx);
  return {
    monthly: monthlyTotal(subs, displayCcy, fx),
    yearly: yearlyTotal(subs, displayCcy, fx),
    activeCount: active.length,
    topCategory: breakdown[0]?.category ?? null,
    biggest,
  };
}

const api = {
  monthlyAmount,
  yearlyAmount,
  convert,
  monthlyTotal,
  yearlyTotal,
  nextRenewal,
  daysUntil,
  upcomingRenewals,
  breakdownByCategory,
  projectedSpend,
  toCSV,
  fromCSV,
  toJSON,
  fromJSON,
  validateSub,
  summary,
};

globalThis.SubEngine = api;

