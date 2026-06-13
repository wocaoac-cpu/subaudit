import assert from "node:assert/strict";
import { writeSync } from "node:fs";
import { test } from "node:test";
import {
  breakdownByCategory,
  convert,
  daysUntil,
  fromCSV,
  fromJSON,
  monthlyAmount,
  monthlyTotal,
  nextRenewal,
  projectedSpend,
  summary,
  toCSV,
  toJSON,
  upcomingRenewals,
  validateSub,
  yearlyAmount,
  yearlyTotal,
} from "./engine.js";
import * as engine from "./engine.js";

let assertionCount = 0;
let failureCount = 0;

function record(fn) {
  assertionCount += 1;
  return fn();
}

function ok(value, message) {
  return record(() => assert.ok(value, message));
}

function equal(actual, expected, message) {
  return record(() => assert.equal(actual, expected, message));
}

function deepEqual(actual, expected, message) {
  return record(() => assert.deepEqual(actual, expected, message));
}

function near(actual, expected, message) {
  return record(() => assert.ok(Math.abs(actual - expected) <= 1e-6, message));
}

function throws(fn, errorType, message) {
  return record(() => assert.throws(fn, errorType, message));
}

function run(name, fn) {
  test(name, () => {
    try {
      fn();
    } catch (error) {
      failureCount += 1;
      throw error;
    }
  });
}

process.on("exit", (code) => {
  if (code === 0 && failureCount === 0) {
    writeSync(1, `ALL ${assertionCount} TESTS PASSED\n`);
  }
});

const fx = {
  USD: 1,
  CNY: 7.2,
  EUR: 0.9,
  GBP: 0.8,
  JPY: 150,
};

const baseSubs = [
  {
    id: "netflix",
    name: "Netflix",
    amount: 15,
    currency: "USD",
    cycle: "monthly",
    anchor: "2024-01-31",
    category: "video",
    active: true,
  },
  {
    id: "cloud",
    name: "Cloud",
    amount: 72,
    currency: "CNY",
    cycle: "monthly",
    anchor: "2024-02-29",
    category: "tools",
    active: true,
  },
  {
    id: "annual",
    name: "Annual Tool",
    amount: 120,
    currency: "EUR",
    cycle: "yearly",
    anchor: "2024-06-15",
    category: "tools",
    active: true,
  },
  {
    id: "inactive",
    name: "Inactive",
    amount: 1000,
    currency: "USD",
    cycle: "monthly",
    anchor: "2024-01-01",
    category: "ignored",
    active: false,
  },
  {
    id: "zero",
    name: "Zero",
    amount: 0,
    currency: "USD",
    cycle: "weekly",
    anchor: "2024-01-01",
    category: "video",
    active: true,
  },
];

run("exports and global attachment", () => {
  const names = [
    "monthlyAmount",
    "yearlyAmount",
    "convert",
    "monthlyTotal",
    "yearlyTotal",
    "nextRenewal",
    "daysUntil",
    "upcomingRenewals",
    "breakdownByCategory",
    "projectedSpend",
    "toCSV",
    "fromCSV",
    "toJSON",
    "fromJSON",
    "validateSub",
    "summary",
  ];
  for (const name of names) {
    equal(typeof engine[name], "function", `${name} should be exported`);
    equal(globalThis.SubEngine[name], engine[name], `${name} should be on globalThis.SubEngine`);
  }
});

run("monthlyAmount and yearlyAmount cover every cycle", () => {
  near(monthlyAmount({ amount: 12, cycle: "weekly" }), 52, "weekly monthly equivalent");
  near(monthlyAmount({ amount: 10, cycle: "monthly" }), 10, "monthly amount");
  near(monthlyAmount({ amount: 30, cycle: "quarterly" }), 10, "quarterly monthly equivalent");
  near(monthlyAmount({ amount: 120, cycle: "yearly" }), 10, "yearly monthly equivalent");
  near(monthlyAmount({ amount: 240, cycle: "biennial" }), 10, "biennial monthly equivalent");
  near(
    monthlyAmount({ amount: 14, cycle: { days: 7 } }),
    (14 * (365.25 / 12)) / 7,
    "custom day cycle monthly equivalent",
  );
  near(yearlyAmount({ amount: 12, cycle: "weekly" }), 624, "weekly yearly equivalent");
  near(yearlyAmount({ amount: 14, cycle: { days: 7 } }), 730.5, "custom day yearly equivalent");
  throws(() => monthlyAmount({ amount: 10, cycle: "daily" }), TypeError, "unknown cycle throws");
  throws(() => monthlyAmount({ amount: Number.NaN, cycle: "monthly" }), TypeError, "NaN throws");
});

run("convert uses fixed fx formula and rejects unknown currency", () => {
  near(convert(10, "USD", "USD", fx), 10, "same currency with rate is identity");
  near(convert(10, "USD", "CNY", fx), 72, "USD to CNY");
  near(convert(72, "CNY", "USD", fx), 10, "CNY to USD");
  near(convert(9, "EUR", "USD", fx), 10, "EUR to USD");
  near(convert(8, "GBP", "EUR", fx), 9, "GBP to EUR");
  throws(() => convert(1, "UAH", "USD", fx), RangeError, "missing source currency throws");
  throws(() => convert(1, "USD", "UAH", fx), RangeError, "missing target currency throws");
  throws(() => convert(1, "USD", "CNY", { USD: 1, CNY: 0 }), RangeError, "zero rate throws");
});

run("totals cover empty, inactive, zero, unknown currency, and mixed currency", () => {
  const expectedMonthlyUSD = 15 + 10 + 120 / 12 / 0.9;
  near(monthlyTotal(baseSubs, "USD", fx), expectedMonthlyUSD, "mixed active monthly total");
  near(yearlyTotal(baseSubs, "USD", fx), expectedMonthlyUSD * 12, "mixed active yearly total");
  near(monthlyTotal([], "USD", fx), 0, "empty monthly total");
  near(yearlyTotal([], "USD", fx), 0, "empty yearly total");
  near(monthlyTotal([baseSubs[3]], "USD", fx), 0, "all inactive monthly total");
  near(yearlyTotal([baseSubs[3]], "USD", fx), 0, "all inactive yearly total");
  near(
    monthlyTotal([{ ...baseSubs[3], currency: "UAH" }], "USD", fx),
    0,
    "inactive unknown currency is ignored",
  );
  throws(
    () => monthlyTotal([{ ...baseSubs[0], currency: "UAH" }], "USD", fx),
    RangeError,
    "active unknown currency throws",
  );
});

run("nextRenewal handles month ends, leap days, and custom day cycles", () => {
  equal(
    nextRenewal({ anchor: "2024-01-31", cycle: "monthly" }, "2024-02-01"),
    "2024-02-29",
    "leap-year February clamps to Feb 29",
  );
  equal(
    nextRenewal({ anchor: "2023-01-31", cycle: "monthly" }, "2023-02-01"),
    "2023-02-28",
    "non-leap February clamps to Feb 28",
  );
  equal(
    nextRenewal({ anchor: "2024-01-31", cycle: "monthly" }, "2024-03-01"),
    "2024-03-31",
    "month-end anchor returns to 31 when available",
  );
  equal(
    nextRenewal({ anchor: "2024-05-10", cycle: "monthly" }, "2024-05-10"),
    "2024-05-10",
    "anchor on today is due today",
  );
  equal(
    nextRenewal({ anchor: "2024-02-29", cycle: "yearly" }, "2024-02-28"),
    "2024-02-29",
    "leap-day anchor before first billing",
  );
  equal(
    nextRenewal({ anchor: "2024-02-29", cycle: "yearly" }, "2025-02-28"),
    "2025-02-28",
    "leap-day annual anchor clamps in non-leap year",
  );
  equal(
    nextRenewal({ anchor: "2024-01-31", cycle: "quarterly" }, "2024-04-01"),
    "2024-04-30",
    "quarterly month-end clamps to April 30",
  );
  equal(
    nextRenewal({ anchor: "2024-01-01", cycle: { days: 7 } }, "2024-01-09"),
    "2024-01-15",
    "custom seven-day cycle rolls by days",
  );
  equal(
    nextRenewal({ anchor: "2024-01-01", cycle: "weekly" }, "2024-01-08"),
    "2024-01-08",
    "weekly cycle can be due today",
  );
  throws(
    () => nextRenewal({ anchor: "2024-02-30", cycle: "monthly" }, "2024-03-01"),
    TypeError,
    "invalid anchor throws",
  );
});

run("daysUntil floors pure date differences", () => {
  equal(daysUntil("2024-06-01", "2024-06-01"), 0, "today is zero");
  equal(daysUntil("2024-06-10", "2024-06-01"), 9, "future date difference");
  equal(daysUntil("2024-05-31", "2024-06-01"), -1, "past date difference");
  throws(() => daysUntil("not-a-date", "2024-06-01"), TypeError, "bad date throws");
});

run("upcomingRenewals filters active subscriptions and sorts by date", () => {
  const renewals = upcomingRenewals(
    [
      { ...baseSubs[0], id: "today", anchor: "2024-06-01", cycle: "monthly", active: true },
      { ...baseSubs[0], id: "five", anchor: "2024-06-06", cycle: "monthly", active: true },
      { ...baseSubs[0], id: "ten", anchor: "2024-06-11", cycle: "monthly", active: true },
      { ...baseSubs[0], id: "inactive-due", anchor: "2024-06-02", active: false },
      { ...baseSubs[0], id: "late", anchor: "2024-06-21", cycle: "monthly", active: true },
    ],
    "2024-06-01",
    10,
  );
  equal(renewals.length, 3, "only active renewals inside window");
  deepEqual(
    renewals.map((item) => item.sub.id),
    ["today", "five", "ten"],
    "renewals sorted by date",
  );
  deepEqual(
    renewals.map((item) => item.days),
    [0, 5, 10],
    "renewal day offsets",
  );
  equal(renewals[0].date, "2024-06-01", "date is included");
  equal(upcomingRenewals(baseSubs, "2024-06-01", -1).length, 0, "negative window returns empty");
});

run("breakdownByCategory groups active subscriptions and sorts by monthly spend", () => {
  const breakdown = breakdownByCategory(baseSubs, "USD", fx);
  equal(breakdown.length, 2, "two active categories");
  equal(breakdown[0].category, "tools", "top category first");
  near(breakdown[0].monthly, 10 + 120 / 12 / 0.9, "tools monthly total");
  near(breakdown[0].yearly, (10 + 120 / 12 / 0.9) * 12, "tools yearly total");
  equal(breakdown[0].count, 2, "tools count");
  equal(breakdown[1].category, "video", "second category");
  near(breakdown[1].monthly, 15, "video monthly includes zero subscription");
  equal(breakdown[1].count, 2, "video count includes active zero amount");
  deepEqual(breakdownByCategory([], "USD", fx), [], "empty breakdown");
  deepEqual(breakdownByCategory([baseSubs[3]], "USD", fx), [], "inactive breakdown");
});

run("projectedSpend follows monthlyTotal times months", () => {
  const expectedMonthlyUSD = monthlyTotal(baseSubs, "USD", fx);
  near(projectedSpend(baseSubs, "USD", fx, 3), expectedMonthlyUSD * 3, "three-month projection");
  near(projectedSpend(baseSubs, "USD", fx, 0), 0, "zero months projects zero");
  near(projectedSpend(baseSubs, "USD", fx, -2), 0, "negative months projects zero");
  near(projectedSpend([baseSubs[3]], "USD", fx, 12), 0, "inactive projection is zero");
});

run("CSV round trips subscriptions and escapes commas and quotes", () => {
  const csvSubs = [
    {
      id: "a",
      name: 'Comma, and "Quote"',
      amount: 0,
      currency: "USD",
      cycle: { days: 7 },
      anchor: "2024-02-29",
      category: 'Ops "A"',
      active: true,
    },
    {
      id: "b",
      name: "Plain",
      amount: 12.5,
      currency: "EUR",
      cycle: "monthly",
      anchor: "2024-03-01",
      category: "Tools",
      active: false,
    },
  ];
  const csv = toCSV(csvSubs);
  ok(csv.startsWith("id,name,amount,currency,cycle,anchor,category,active"), "CSV header exists");
  ok(csv.includes('"Comma, and ""Quote"""'), "CSV quotes comma and quote");
  const parsed = fromCSV(csv);
  deepEqual(parsed, csvSubs, "CSV roundtrip is equivalent");
  equal(parsed[0].name, 'Comma, and "Quote"', "name unescaped");
  deepEqual(parsed[0].cycle, { days: 7 }, "custom cycle parsed");
  equal(parsed[1].active, false, "boolean false parsed");
  equal(parsed[0].amount, 0, "zero amount parsed");
  deepEqual(fromCSV(""), [], "empty CSV parses empty");
  deepEqual(fromCSV("id,name,amount,currency,cycle,anchor,category,active"), [], "header-only CSV parses empty");
  deepEqual(
    fromCSV('id,name,amount,currency,cycle,anchor,category,active\r\nx,"Quoted ""Name"", Inc",5,USD,monthly,2024-01-01,Misc,true')[0].name,
    'Quoted "Name", Inc',
    "manual CRLF CSV parses escaped field",
  );
});

run("JSON round trips and bad input is tolerant", () => {
  const json = toJSON(baseSubs);
  ok(json.includes("netflix"), "JSON contains data");
  deepEqual(fromJSON(json), baseSubs, "JSON roundtrip is equivalent");
  deepEqual(fromJSON("{bad"), [], "bad JSON returns empty array");
  deepEqual(fromJSON('{"not":"array"}'), [], "non-array JSON returns empty array");
  deepEqual(fromJSON("null"), [], "null JSON returns empty array");
});

run("validateSub reports field-level validity", () => {
  deepEqual(validateSub(baseSubs[0]), { ok: true, errors: [] }, "valid subscription passes");
  deepEqual(
    validateSub({ ...baseSubs[0], amount: 0, cycle: { days: 7 }, anchor: "2024-02-29" }),
    { ok: true, errors: [] },
    "zero amount, leap day, and custom cycle pass",
  );
  const invalid = validateSub({
    id: "",
    name: "",
    amount: -1,
    currency: "usd",
    cycle: { days: 0 },
    anchor: "2024-02-30",
    category: 1,
    active: "true",
  });
  equal(invalid.ok, false, "invalid subscription fails");
  ok(invalid.errors.some((error) => error.includes("id")), "id error present");
  ok(invalid.errors.some((error) => error.includes("name")), "name error present");
  ok(invalid.errors.some((error) => error.includes("amount")), "amount error present");
  ok(invalid.errors.some((error) => error.includes("currency")), "currency error present");
  ok(invalid.errors.some((error) => error.includes("cycle")), "cycle error present");
  ok(invalid.errors.some((error) => error.includes("anchor")), "anchor error present");
  ok(invalid.errors.some((error) => error.includes("category")), "category error present");
  ok(invalid.errors.some((error) => error.includes("active")), "active error present");
  const nullResult = validateSub(null);
  equal(nullResult.ok, false, "null fails");
  ok(nullResult.errors[0].includes("object"), "null object error");
});

run("summary returns UI-ready aggregate data", () => {
  const result = summary(baseSubs, "USD", fx);
  near(result.monthly, monthlyTotal(baseSubs, "USD", fx), "summary monthly");
  near(result.yearly, yearlyTotal(baseSubs, "USD", fx), "summary yearly");
  equal(result.activeCount, 4, "summary active count");
  equal(result.topCategory, "tools", "summary top category");
  equal(result.biggest.id, "netflix", "summary biggest sub");
  deepEqual(summary([], "USD", fx), {
    monthly: 0,
    yearly: 0,
    activeCount: 0,
    topCategory: null,
    biggest: null,
  }, "empty summary");
  deepEqual(summary([baseSubs[3]], "USD", fx), {
    monthly: 0,
    yearly: 0,
    activeCount: 0,
    topCategory: null,
    biggest: null,
  }, "inactive summary");
});

