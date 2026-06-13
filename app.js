/* SubAudit / 订阅审计 — local-only subscription cost auditor.
   UI + i18n(en/zh/uk) wired to window.SubEngine (see SPEC_ENGINE.md). Zero backend, localStorage only. */
(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const E = () => window.SubEngine;
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

  // ---- static FX (approx, base USD; clearly an estimate; user can think in any display ccy) ----
  const FX = { USD:1, CNY:7.2, EUR:0.92, GBP:0.79, JPY:157, UAH:41, HKD:7.8, CAD:1.37, AUD:1.51 };
  const CCYS = Object.keys(FX);
  const SYM = { USD:"$", CNY:"¥", EUR:"€", GBP:"£", JPY:"¥", UAH:"₴", HKD:"HK$", CAD:"C$", AUD:"A$" };
  const CYCLES = ["weekly","monthly","quarterly","yearly","biennial"];

  // ---------------- i18n ----------------
  const I18N = {
    en:{ logoSub:"· local-only", lock:"100% on-device", kicker:"PRIVATE · LOCAL-ONLY · NO UPLOAD",
      h1:'You think you spend $86/mo. <em>You spend $219.</em>',
      lede:'SubAudit shows what your subscriptions <b>really</b> cost — per month, per year, and what to cut. Everything stays on your device.',
      dTrueYear:"Your true yearly spend", dMonthly:"Per month", dBiggest:"Biggest drain",
      yourSubs:"Your subscriptions", add:"Add", loadSample:"Load sample",
      phName:"Subscription name", phAmount:"Amount", phCat:"Category (e.g. Streaming)",
      thName:"Name", thAmount:"Price", thCycle:"Cycle", thMonthly:"Monthly", thNext:"Next", thActs:"",
      upcoming:"Renewing soon (30 days)", byCat:"By category",
      dataTitle:"Your data", import:"Import", clearAll:"Clear all",
      dataNote:"Export a backup or move devices. Import accepts the JSON or CSV exported here. Nothing is ever uploaded — your subscriptions live only in this browser.",
      editTitle:"Edit subscription", ccy:"Currency", cycle:"Cycle", anchor:"Next/first billing date", cancel:"Cancel", save:"Save",
      sortMonthly:"Sort: cost ↓", sortName:"Sort: name", sortNext:"Sort: next renewal",
      none:"No subscriptions yet — add one above, or load the sample.",
      noUp:"Nothing due in the next 30 days.",
      xiaomo:"Surprised? That's okay — now you can gently take back control.",
      foot:"SubAudit · 100% local, zero upload · your financial data never leaves this device · 0017",
      why:[{h:"The pain",p:"<b>41% of people</b> have subscription fatigue and spend ~<b>$219/mo</b> on subscriptions while guessing ~$86. The money leaks because nothing shows the true total."},
           {h:"Local-only, on purpose",p:"Your subscriptions and amounts are <b>financial data</b>. They stay in your browser — no account, no cloud, no upload. Works offline."},
           {h:"One-time, not another subscription",p:"The irony of paying a monthly fee to track monthly fees ends here. SubAudit is free and local — <b>no subscription to audit your subscriptions</b>."}],
      tAdded:"Added", tDeleted:"Deleted", tSaved:"Saved", tCleared:"Cleared", tImported:n=>"Imported "+n+" subscriptions", tImportFail:"Import failed — not a valid SubAudit file", tNeedName:"Enter a name and amount first",
      perMo:"/mo", paused:"paused", activeN:(a,t)=>a+" active · "+t+" total", noData:"add subscriptions to see this",
      cyc:{weekly:"Weekly",monthly:"Monthly",quarterly:"Quarterly",yearly:"Yearly",biennial:"Every 2 yrs"},
      vsGuess:g=>"That's "+g+"× what most people guess." },
    zh:{ logoSub:"· 纯本地", lock:"100% 在本机", kicker:"私密 · 纯本地 · 零上传",
      h1:'你以为每月花 ¥600。<em>其实是 ¥1500。</em>',
      lede:'订阅审计帮你看清订阅<b>真实</b>花多少——每月、每年、该砍哪个。所有数据只留在你的设备上。',
      dTrueYear:"你的真实年度花费", dMonthly:"每月", dBiggest:"最大的钱漏",
      yourSubs:"你的订阅", add:"添加", loadSample:"载入示例",
      phName:"订阅名称", phAmount:"金额", phCat:"分类（如：视频）",
      thName:"名称", thAmount:"价格", thCycle:"周期", thMonthly:"折合月", thNext:"下次", thActs:"",
      upcoming:"即将续费（30 天内）", byCat:"按分类",
      dataTitle:"你的数据", import:"导入", clearAll:"清空",
      dataNote:"导出备份或换设备时用。导入接受这里导出的 JSON 或 CSV。数据从不上传——你的订阅只活在这个浏览器里。",
      editTitle:"编辑订阅", ccy:"币种", cycle:"周期", anchor:"下次/首次计费日", cancel:"取消", save:"保存",
      sortMonthly:"排序：花费 ↓", sortName:"排序：名称", sortNext:"排序：续费日",
      none:"还没有订阅——在上方添加一条，或载入示例。",
      noUp:"未来 30 天没有要续费的。",
      xiaomo:"有点意外吧？没关系，现在你能慢慢拿回主动权了。",
      foot:"订阅审计 · 100% 本地、零上传 · 你的财务数据从不离开本设备 · 0017",
      why:[{h:"痛点",p:"<b>41% 的人</b>有订阅疲劳、每月在订阅上花约 <b>¥1500</b>，却以为只花 ¥600。钱在漏，因为没人告诉你真实总额。"},
           {h:"故意做成纯本地",p:"你的订阅和金额是<b>财务数据</b>。它们只留在你浏览器里——无账号、无云端、零上传，断网也能用。"},
           {h:"买断，而非又一个订阅",p:"花月费去管理月费，这个讽刺到此为止。订阅审计免费且本地——<b>管你的订阅，不用再订阅</b>。"}],
      tAdded:"已添加", tDeleted:"已删除", tSaved:"已保存", tCleared:"已清空", tImported:n=>"已导入 "+n+" 条订阅", tImportFail:"导入失败——不是有效的 SubAudit 文件", tNeedName:"先填名称和金额",
      perMo:"/月", paused:"已暂停", activeN:(a,t)=>a+" 活跃 · 共 "+t, noData:"添加订阅后显示",
      cyc:{weekly:"每周",monthly:"每月",quarterly:"每季",yearly:"每年",biennial:"每两年"},
      vsGuess:g=>"是大多数人预估的 "+g+" 倍。" },
    uk:{ logoSub:"· лише локально", lock:"100% на пристрої", kicker:"ПРИВАТНО · ЛИШЕ ЛОКАЛЬНО · БЕЗ ЗАВАНТАЖЕНЬ",
      h1:'Думаєте $86/міс. <em>Витрачаєте $219.</em>',
      lede:'SubAudit показує, скільки <b>насправді</b> коштують ваші підписки — за місяць, за рік, і що скасувати. Усе лишається на вашому пристрої.',
      dTrueYear:"Справжні витрати за рік", dMonthly:"За місяць", dBiggest:"Найбільша витік",
      yourSubs:"Ваші підписки", add:"Додати", loadSample:"Приклад",
      phName:"Назва підписки", phAmount:"Сума", phCat:"Категорія (напр. Стрімінг)",
      thName:"Назва", thAmount:"Ціна", thCycle:"Цикл", thMonthly:"На місяць", thNext:"Далі", thActs:"",
      upcoming:"Скоро поновлення (30 днів)", byCat:"За категорією",
      dataTitle:"Ваші дані", import:"Імпорт", clearAll:"Очистити",
      dataNote:"Експортуйте резервну копію або перенесіть на інший пристрій. Імпорт приймає експортовані тут JSON чи CSV. Нічого не завантажується — підписки живуть лише в цьому браузері.",
      editTitle:"Редагувати підписку", ccy:"Валюта", cycle:"Цикл", anchor:"Дата наступного/першого платежу", cancel:"Скасувати", save:"Зберегти",
      sortMonthly:"Сорт: ціна ↓", sortName:"Сорт: назва", sortNext:"Сорт: поновлення",
      none:"Ще немає підписок — додайте вище або завантажте приклад.",
      noUp:"Нічого не списується найближчі 30 днів.",
      xiaomo:"Здивовані? Нічого — тепер можна м'яко повернути контроль.",
      foot:"SubAudit · 100% локально, без завантажень · фінансові дані не покидають пристрій · 0017",
      why:[{h:"Проблема",p:"<b>41% людей</b> мають втому від підписок і витрачають ~<b>$219/міс</b>, гадаючи що ~$86. Гроші течуть, бо ніщо не показує справжню суму."},
           {h:"Лише локально — навмисно",p:"Ваші підписки та суми — це <b>фінансові дані</b>. Вони лишаються у браузері: без акаунта, без хмари, без завантажень. Працює офлайн."},
           {h:"Разова, а не ще одна підписка",p:"Іронія платити щомісяця за облік щомісячних платежів завершується тут. SubAudit безкоштовний і локальний — <b>жодної підписки заради підписок</b>."}],
      tAdded:"Додано", tDeleted:"Видалено", tSaved:"Збережено", tCleared:"Очищено", tImported:n=>"Імпортовано "+n+" підписок", tImportFail:"Помилка імпорту — недійсний файл SubAudit", tNeedName:"Спершу введіть назву та суму",
      perMo:"/міс", paused:"пауза", activeN:(a,t)=>a+" активних · "+t+" всього", noData:"додайте підписки",
      cyc:{weekly:"Щотижня",monthly:"Щомісяця",quarterly:"Щокварталу",yearly:"Щороку",biennial:"Раз на 2 роки"},
      vsGuess:g=>"Це у "+g+"× більше, ніж зазвичай гадають." }
  };
  let lang = (()=>{ const s=localStorage.getItem("subaudit.lang"); if(s) return s; const n=(navigator.language||"en").toLowerCase(); return n.startsWith("zh")?"zh":n.startsWith("uk")?"uk":"en"; })();
  const T = () => I18N[lang];

  // ---------------- state ----------------
  let subs = [];
  let dispCcy = localStorage.getItem("subaudit.ccy") || (lang==="zh"?"CNY":lang==="uk"?"UAH":"USD");
  let sortBy = localStorage.getItem("subaudit.sort") || "monthly";
  let editId = null;

  function load(){ try{ subs = JSON.parse(localStorage.getItem("subaudit.subs")||"[]"); if(!Array.isArray(subs)) subs=[]; }catch(e){ subs=[]; } }
  function save(){ localStorage.setItem("subaudit.subs", JSON.stringify(subs)); }

  function uid(){ return "s"+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3); }
  function todayISO(){ return new Date().toISOString().slice(0,10); }

  // money format in display currency
  function fmt(amountInCcy, ccy){
    const sym = SYM[ccy]||"";
    const dec = (ccy==="JPY"||ccy==="UAH") ? 0 : 0; // totals shown whole for calm
    const n = Math.round(amountInCcy);
    return sym + n.toLocaleString(undefined,{maximumFractionDigits:dec});
  }
  function fmtPrecise(amountInCcy, ccy){ const sym=SYM[ccy]||""; return sym+(Math.round(amountInCcy*100)/100).toLocaleString(undefined,{maximumFractionDigits:2}); }

  // ---------------- render ----------------
  function render(){
    const eng = E();
    // dashboard
    const sm = eng.summary(subs, dispCcy, FX);
    const yearly = eng.yearlyTotal(subs, dispCcy, FX);
    const monthly = eng.monthlyTotal(subs, dispCcy, FX);
    $("trueYear").textContent = subs.some(s=>s.active) ? fmt(yearly,dispCcy) : "—";
    $("monthlyTot").textContent = subs.some(s=>s.active) ? fmt(monthly,dispCcy)+T().perMo : "—";
    const active = subs.filter(s=>s.active).length;
    $("activeNote").textContent = subs.length ? T().activeN(active, subs.length) : T().noData;
    // true-year note: multiple of the $86 guess (~ usd guess scaled)
    if(subs.some(s=>s.active)){
      const usdYear = eng.yearlyTotal(subs,"USD",FX);
      const mult = (usdYear/ (86*12));
      $("trueYearNote").textContent = mult>=1.1 ? T().vsGuess(mult.toFixed(1)) : "";
    } else $("trueYearNote").textContent="";
    // biggest
    if(sm && sm.biggest){ $("biggest").textContent = sm.biggest.name; $("biggestNote").textContent = fmt(eng.convert(eng.monthlyAmount(sm.biggest), sm.biggest.currency, dispCcy, FX), dispCcy)+T().perMo; }
    else { $("biggest").textContent="—"; $("biggestNote").textContent=T().noData; }

    // table
    const tbl = $("tbl");
    const sorted = sortSubs(subs.slice());
    let h = `<div class="trow head"><div>${T().thName}</div><div>${T().thAmount}</div><div>${T().thCycle}</div><div>${T().thMonthly}</div><div>${T().thNext}</div><div></div></div>`;
    if(!sorted.length){ tbl.innerHTML = h + `<div class="empty">${T().none}</div>`; }
    else {
      h += sorted.map(s=>{
        const mo = eng.convert(eng.monthlyAmount(s), s.currency, dispCcy, FX);
        const nxt = eng.nextRenewal(s, todayISO());
        const du = eng.daysUntil(nxt, todayISO());
        return `<div class="trow${s.active?'':' paused'}" data-id="${esc(s.id)}">
          <div class="nm">${esc(s.name)} ${s.category?`<span class="cat">${esc(s.category)}</span>`:''}</div>
          <div class="mono">${fmtPrecise(s.amount,s.currency)} <span style="color:var(--dim2)">${s.currency}</span></div>
          <div>${T().cyc[typeof s.cycle==='string'?s.cycle:'custom']||s.cycle}</div>
          <div class="mono">${fmt(mo,dispCcy)}${T().perMo}</div>
          <div class="mono" title="${nxt}">${nxt.slice(5)} <span style="color:${du<=7?'var(--warn)':'var(--dim2)'}">(${du}d)</span></div>
          <div class="acts">
            <button class="iconbtn" data-act="toggle" title="${s.active?T().paused:'active'}">${s.active?'⏸':'▶'}</button>
            <button class="iconbtn" data-act="edit" title="edit">✎</button>
            <button class="iconbtn del" data-act="del" title="delete">✕</button>
          </div></div>`;
      }).join("");
      tbl.innerHTML = h;
    }

    // upcoming
    const up = eng.upcomingRenewals(subs, todayISO(), 30);
    $("upcoming").innerHTML = up.length ? up.map(u=>{
      const mo = eng.convert(eng.monthlyAmount(u.sub), u.sub.currency, dispCcy, FX);
      return `<div class="up"><span>${esc(u.sub.name)}</span><span class="d ${u.days<=7?'soon':''}">${u.date.slice(5)} · ${u.days}d</span></div>`;
    }).join("") : `<div style="color:var(--dim2);font-size:13px;padding:8px 0">${T().noUp}</div>`;

    // by category
    const cats = eng.breakdownByCategory(subs, dispCcy, FX).filter(c=>c.monthly>0);
    const max = cats.length ? cats[0].monthly : 1;
    $("cats").innerHTML = cats.length ? cats.map(c=>`
      <div class="catbar"><div class="cr"><span>${esc(c.category||"—")} <span style="color:var(--dim2)">(${c.count})</span></span><span class="mono">${fmt(c.monthly,dispCcy)}${T().perMo}</span></div>
      <div class="track"><div class="fill" style="width:${Math.max(4,c.monthly/max*100)}%"></div></div></div>`).join("")
      : `<div style="color:var(--dim2);font-size:13px">${T().noData}</div>`;
  }

  function sortSubs(arr){
    const eng = E();
    if(sortBy==="name") return arr.sort((a,b)=>a.name.localeCompare(b.name));
    if(sortBy==="next") return arr.sort((a,b)=>eng.nextRenewal(a,todayISO()).localeCompare(eng.nextRenewal(b,todayISO())));
    return arr.sort((a,b)=>eng.convert(eng.monthlyAmount(b),b.currency,dispCcy,FX)-eng.convert(eng.monthlyAmount(a),a.currency,dispCcy,FX));
  }

  // ---------------- i18n apply ----------------
  function applyI18n(){
    document.documentElement.lang = lang==="zh"?"zh-CN":lang==="uk"?"uk":"en";
    document.querySelectorAll("[data-i]").forEach(el=>{ const k=el.getAttribute("data-i"); if(T()[k]!=null) el.innerHTML=T()[k]; });
    document.querySelectorAll("[data-ph]").forEach(el=>{ const k=el.getAttribute("data-ph"); if(T()[k]!=null) el.placeholder=T()[k]; });
    $("h1").innerHTML=T().h1; $("lede").innerHTML=T().lede; $("foot").textContent=T().foot;
    $("xiaomoLine").innerHTML = esc(T().xiaomo)+' <b>♡ 小茉</b>';
    $("why").innerHTML=T().why.map(w=>`<div><h4>${esc(w.h)}</h4><p>${w.p}</p></div>`).join("");
    // langs
    $("langs").innerHTML=["zh","en","uk"].map(l=>`<button class="${l===lang?'on':''}" data-l="${l}">${l==='zh'?'中文':l==='en'?'EN':'УК'}</button>`).join("");
    $("langs").querySelectorAll("button").forEach(b=>b.onclick=()=>{ lang=b.dataset.l; localStorage.setItem("subaudit.lang",lang); buildSelects(); applyI18n(); render(); });
    // sort options
    $("sortBy").innerHTML=`<option value="monthly">${T().sortMonthly}</option><option value="name">${T().sortName}</option><option value="next">${T().sortNext}</option>`;
    $("sortBy").value=sortBy;
    $("addBtn").textContent=T().add;
    // edit modal labels handled by data-i
  }

  function buildSelects(){
    const ccyOpts = CCYS.map(c=>`<option value="${c}">${c}</option>`).join("");
    $("dispCcy").innerHTML = ccyOpts; $("dispCcy").value=dispCcy;
    $("f-ccy").innerHTML = ccyOpts; $("f-ccy").value=dispCcy;
    $("e-ccy").innerHTML = ccyOpts;
    const cycOpts = CYCLES.map(c=>`<option value="${c}">${T().cyc[c]}</option>`).join("");
    $("f-cycle").innerHTML=cycOpts; $("f-cycle").value="monthly";
    $("e-cycle").innerHTML=cycOpts;
  }

  // ---------------- actions ----------------
  function addSub(){
    const name=$("f-name").value.trim(), amount=parseFloat($("f-amount").value);
    if(!name || !(amount>=0) || isNaN(amount)){ toast(T().tNeedName); return; }
    const sub={ id:uid(), name, amount, currency:$("f-ccy").value, cycle:$("f-cycle").value,
      anchor:$("f-anchor").value||todayISO(), category:$("f-cat").value.trim(), active:true };
    const v=E().validateSub(sub); if(!v.ok){ toast(v.errors[0]||T().tNeedName); return; }
    subs.push(sub); save(); render();
    $("f-name").value=""; $("f-amount").value=""; $("f-cat").value=""; $("f-name").focus();
    toast(T().tAdded);
  }
  function openEdit(id){ const s=subs.find(x=>x.id===id); if(!s) return; editId=id;
    $("e-name").value=s.name; $("e-amount").value=s.amount; $("e-ccy").value=s.currency;
    $("e-cycle").value=typeof s.cycle==='string'?s.cycle:'monthly'; $("e-anchor").value=s.anchor; $("e-cat").value=s.category||"";
    $("modal").classList.add("on"); }
  function saveEdit(){ const s=subs.find(x=>x.id===editId); if(!s) return;
    s.name=$("e-name").value.trim()||s.name; s.amount=parseFloat($("e-amount").value)||0;
    s.currency=$("e-ccy").value; s.cycle=$("e-cycle").value; s.anchor=$("e-anchor").value||s.anchor; s.category=$("e-cat").value.trim();
    save(); render(); $("modal").classList.remove("on"); toast(T().tSaved); }

  function download(filename, text, type){ const b=new Blob([text],{type}); const u=URL.createObjectURL(b);
    const a=document.createElement("a"); a.href=u; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000); }

  function importFile(file){ const r=new FileReader(); r.onload=()=>{ try{
    let arr; const txt=String(r.result);
    if(file.name.endsWith(".csv")) arr=E().fromCSV(txt); else arr=E().fromJSON(txt);
    if(!Array.isArray(arr)||!arr.length) throw new Error("empty");
    // normalize ids/active
    arr.forEach(s=>{ if(!s.id) s.id=uid(); if(typeof s.active!=='boolean') s.active=true; });
    subs=arr; save(); render(); toast(T().tImported(arr.length));
  }catch(e){ toast(T().tImportFail); } }; r.readAsText(file); }

  // sample subs: USD base amounts; amount & currency always consistent (convert USD->dispCcy via engine, round for clean demo)
  function cat(en,zh,uk){ return lang==="zh"?zh:lang==="uk"?uk:en; }
  function amt(usd){ const v=E().convert(usd, "USD", dispCcy, FX); return (dispCcy==="USD"||dispCcy==="EUR"||dispCcy==="GBP"||dispCcy==="CAD"||dispCcy==="AUD"||dispCcy==="HKD") ? Math.round(v*100)/100 : Math.round(v); }
  const SAMPLE = ()=>[
    {id:uid(),name:"Netflix",amount:amt(15.49),currency:dispCcy,cycle:"monthly",anchor:offset(8),category:cat("Streaming","视频","Стрімінг"),active:true},
    {id:uid(),name:"Spotify",amount:amt(11.99),currency:dispCcy,cycle:"monthly",anchor:offset(3),category:cat("Music","音乐","Музика"),active:true},
    {id:uid(),name:"iCloud 2TB",amount:amt(9.99),currency:dispCcy,cycle:"monthly",anchor:offset(20),category:cat("Cloud","云存储","Хмара"),active:true},
    {id:uid(),name:"Adobe CC",amount:amt(59.99),currency:dispCcy,cycle:"monthly",anchor:offset(12),category:cat("Tools","工具","Інструменти"),active:true},
    {id:uid(),name:"ChatGPT Plus",amount:amt(20),currency:dispCcy,cycle:"monthly",anchor:offset(5),category:"AI",active:true},
    {id:uid(),name:"Amazon Prime",amount:amt(139),currency:dispCcy,cycle:"yearly",anchor:offset(120),category:cat("Shopping","购物","Покупки"),active:true},
    {id:uid(),name:"Disney+",amount:amt(13.99),currency:dispCcy,cycle:"monthly",anchor:offset(15),category:cat("Streaming","视频","Стрімінг"),active:false}
  ];
  function offset(days){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }

  function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2800); }

  // ---------------- wire ----------------
  function init(){
    if(!E()){ document.getElementById("tbl").innerHTML='<div class="empty">engine.js not loaded</div>'; return; }
    load(); buildSelects(); applyI18n(); render();
    $("addBtn").onclick=addSub;
    $("f-name").addEventListener("keydown",e=>{ if(e.key==="Enter") addSub(); });
    $("f-amount").addEventListener("keydown",e=>{ if(e.key==="Enter") addSub(); });
    $("tbl").addEventListener("click",e=>{ const btn=e.target.closest("[data-act]"); if(!btn) return;
      const row=btn.closest("[data-id]"); const id=row.dataset.id; const s=subs.find(x=>x.id===id); if(!s) return;
      const act=btn.dataset.act;
      if(act==="toggle"){ s.active=!s.active; save(); render(); }
      else if(act==="edit"){ openEdit(id); }
      else if(act==="del"){ subs=subs.filter(x=>x.id!==id); save(); render(); toast(T().tDeleted); }
    });
    $("dispCcy").onchange=()=>{ dispCcy=$("dispCcy").value; localStorage.setItem("subaudit.ccy",dispCcy); render(); };
    $("sortBy").onchange=()=>{ sortBy=$("sortBy").value; localStorage.setItem("subaudit.sort",sortBy); render(); };
    $("loadSample").onclick=()=>{ subs=SAMPLE(); save(); render(); toast(T().tImported(subs.length)); };
    $("expJson").onclick=()=>download("subaudit-backup.json", E().toJSON(subs), "application/json");
    $("expCsv").onclick=()=>download("subaudit.csv", E().toCSV(subs), "text/csv");
    $("impBtn").onclick=()=>$("impFile").click();
    $("impFile").onchange=e=>{ if(e.target.files[0]) importFile(e.target.files[0]); e.target.value=""; };
    $("clearAll").onclick=()=>{ if(subs.length && confirm(lang==="zh"?"清空所有订阅？":lang==="uk"?"Очистити всі підписки?":"Clear all subscriptions?")){ subs=[]; save(); render(); toast(T().tCleared); } };
    $("e-cancel").onclick=()=>$("modal").classList.remove("on");
    $("e-save").onclick=saveEdit;
    $("modal").addEventListener("click",e=>{ if(e.target.id==="modal") $("modal").classList.remove("on"); });

    window.__sub={ get subs(){return subs;}, render, addSubObj:(o)=>{subs.push(o);save();render();}, T, get lang(){return lang;}, setLang:l=>{lang=l;buildSelects();applyI18n();render();}, FX };
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
})();
