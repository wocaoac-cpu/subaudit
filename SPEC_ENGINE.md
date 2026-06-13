# SubAudit · 引擎契约 SPEC（给 Codex 实现）

纯逻辑、零 DOM、零网络。产出三个文件，放在本目录：
- `engine.js` —— ES module，导出下列纯函数；同时挂到 `globalThis.SubEngine`（浏览器可直接用）。
- `test.mjs` —— Node 原生测试（`node:assert` + `node:test` 或自写 runner），**至少 40 条断言**，覆盖每个函数 + 全部边界；全绿。
- `package.json` —— `{ "type":"module", "scripts": { "check": "node test.mjs" } }`。

## 数据模型
```
Subscription = {
  id: string, name: string,
  amount: number,            // 每个计费周期的金额（>=0）
  currency: string,          // ISO: USD/CNY/EUR/GBP/JPY/UAH...
  cycle: "weekly"|"monthly"|"quarterly"|"yearly"|"biennial"|{days:number},
  anchor: string,            // ISO 日期 "YYYY-MM-DD"，首次/参考计费日
  category: string,          // 任意分类
  active: boolean            // false 不计入总额
}
FxRates = { [currency]: number }  // 相对 1 单位 base 的汇率；换算: amountInBase = amount / rate[currency] * rate[base] —— 你定义清楚并在测试里固定
```

## 必须导出的函数（命名固定，UI 会按此调用）
1. `monthlyAmount(sub) -> number` 把一条订阅折算成"每月等效金额"（原币种）。weekly=amount*52/12；quarterly=amount/3；yearly=amount/12；biennial=amount/24；{days:n}=amount*(365.25/12)/n。
2. `yearlyAmount(sub) -> number` 每年等效（原币种）。
3. `convert(amount, from, to, fx) -> number` 币种换算（fx 缺某币种时抛错或返回 NaN，需在测试里定义并验证一种明确行为）。
4. `monthlyTotal(subs, displayCcy, fx) -> number` 仅 active，折算到 displayCcy 的每月总额。
5. `yearlyTotal(subs, displayCcy, fx) -> number` 同上，年度。
6. `nextRenewal(sub, todayISO) -> string` 从 anchor 按 cycle 滚动到 >= today 的下一个计费日（ISO）。**月末锚点**：anchor=1/31，monthly → 2/28（或闰年 2/29），不得溢出到 3/2。
7. `daysUntil(dateISO, todayISO) -> number` 相差天数（向下取整，今天=0）。
8. `upcomingRenewals(subs, todayISO, withinDays) -> Array<{sub, date, days}>` 仅 active，withinDays 内，按日期升序。
9. `breakdownByCategory(subs, displayCcy, fx) -> Array<{category, monthly, yearly, count}>` 按分类汇总，monthly 降序。
10. `projectedSpend(subs, displayCcy, fx, months) -> number` 未来 months 个月的总投放（=monthlyTotal*months，但若有 yearly/biennial 落在窗口内需按真实落点累加更佳；最低实现 monthlyTotal*months，测试按你的实现写死）。
11. `toCSV(subs) -> string` / `fromCSV(text) -> subs`（往返一致：fromCSV(toCSV(x)) 等价 x）。
12. `toJSON(subs)->string` / `fromJSON(text)->subs`（容错：坏 JSON 抛错或返回 []，测试验证）。
13. `validateSub(obj) -> {ok:boolean, errors:string[]}` 校验一条订阅字段合法。
14. `summary(subs, displayCcy, fx) -> {monthly, yearly, activeCount, topCategory, biggest}` 一次性给 UI 用的汇总。

## 边界（测试必须覆盖）
- 空数组、全 inactive、单条；金额 0；未知 currency；闰年 2/29；月末锚点滚动；{days:7} 自定义周期；多币种混合总额；CSV 含逗号/引号的 name 转义往返；fromJSON 坏输入。
- 浮点：金额比较用容差（如 1e-6）。

## 交付要求
- 跑 `npm run check` 必须全绿，最后打印 `ALL N TESTS PASSED`。
- 不依赖任何第三方包（纯 Node 标准库）。
- 代码清晰、有注释；函数签名严格按上面来（UI 依赖）。
