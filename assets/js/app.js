// 班费管理 · 前端应用逻辑（演示原型，数据存 localStorage）
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const view = $("#view");

  const money = (n) => (Number(n) || 0).toFixed(2);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const memberName = (id) => {
    const m = DB.getMembers().find((x) => x.id === id);
    return m ? m.name : "—";
  };
  const catName = (id) => {
    const c = DB.getCategories().find((x) => x.id === id);
    return c ? c.name : "其他";
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.style.display = "none"), 2200);
  }

  function requireAdmin() {
    if (!DB.isAdmin()) {
      toast("仅班委可操作，成员为只读");
      return false;
    }
    return true;
  }

  function openModal(title, bodyHTML) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHTML;
    $("#modal").style.display = "flex";
  }
  function closeModal() {
    $("#modal").style.display = "none";
    $("#modal-body").innerHTML = "";
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- 登录 ----------
  function initLogin() {
    const user = DB.getUser();
    if (user) enterApp();
    $("#login-btn").addEventListener("click", () => {
      const name = $("#login-name").value.trim();
      const role = $("#login-role").value;
      if (!name) return toast("请输入姓名");
      DB.setUser({ name, isAdmin: role === "admin" });
      enterApp();
    });
    $("#logout-btn").addEventListener("click", () => {
      DB.setUser(null);
      location.hash = "";
      $("#app").style.display = "none";
      $("#login").style.display = "flex";
    });
  }

  function enterApp() {
    const u = DB.getUser();
    $("#login").style.display = "none";
    $("#app").style.display = "flex";
    $("#user-box").innerHTML = `👤 ${esc(u.name)}<br/><small>${u.isAdmin ? "班委 · 可记账" : "成员 · 只读"}</small>`;
    if (!location.hash) location.hash = "#dashboard";
    route();
  }

  // ---------- 路由 ----------
  function route() {
    const map = {
      dashboard: renderDashboard,
      members: renderMembers,
      income: renderIncome,
      expense: renderExpense,
      ledger: renderLedger,
      reports: renderReports,
      settings: renderSettings
    };
    const name = (location.hash || "#dashboard").slice(1);
    (map[name] || renderDashboard)();
    document.querySelectorAll(".nav-item").forEach((a) =>
      a.classList.toggle("active", a.getAttribute("href") === "#" + name)
    );
    window.scrollTo(0, 0);
  }

  function page(title, html) {
    return `<section class="page"><h1 class="page-title">${title}</h1>${html}</section>`;
  }
  function btn(label, cls = "btn-primary") {
    return `<button class="btn ${cls}">${label}</button>`;
  }

  // ---------- 仪表盘 ----------
  function renderDashboard() {
    const t = DB.totals();
    const recent = [...DB.getIncomes().filter((i) => i.paid).map((i) => ({
        type: "收入", date: i.payDate, who: memberName(i.memberId), amt: i.amount, note: i.note
      })),
      ...DB.getExpenses().map((e) => ({
        type: "支出", date: e.date, who: e.purpose, amt: -e.amount, note: catName(e.categoryId)
      }))
    ].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);

    const rows = recent.length
      ? recent.map((r) => `<tr><td>${r.date}</td><td><span class="badge ${r.type === "收入" ? "b-income" : "b-expense"}">${r.type}</span></td><td>${esc(r.who)}</td><td class="${r.amt < 0 ? "neg" : "pos"}">${r.amt < 0 ? "-" : "+"}${money(Math.abs(r.amt))}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">暂无记录，去收缴或记账吧</td></tr>`;

    view.innerHTML = page("仪表盘", `
      <div class="cards">
        <div class="stat"><div class="stat-label">当前余额</div><div class="stat-num">¥${money(t.balance)}</div></div>
        <div class="stat"><div class="stat-label">已收班费</div><div class="stat-num pos">¥${money(t.paidIncome)}</div></div>
        <div class="stat"><div class="stat-label">累计支出</div><div class="stat-num neg">¥${money(t.expense)}</div></div>
      </div>
      <div class="row-actions">
        ${DB.isAdmin() ? `<button class="btn btn-primary" onclick="APP.go('income')">+ 班费收缴</button><button class="btn btn-primary" onclick="APP.go('expense')">+ 记一笔支出</button>` : `<span class="muted">你是只读成员，可查看全部收支</span>`}
      </div>
      <div class="panel"><h3>最近动态</h3>
        <table class="tbl"><thead><tr><th>日期</th><th>类型</th><th>摘要</th><th>金额</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `);
  }

  // ---------- 成员 ----------
  function renderMembers() {
    const ms = DB.getMembers();
    const rows = ms.map((m) => `<tr>
      <td>${esc(m.name)}</td><td>${esc(m.student_no || "—")}</td>
      <td>${m.isAdmin ? '<span class="badge b-admin">班委</span>' : "成员"}</td>
      <td>${m.status === "active" ? "在读" : "已毕业"}</td>
      <td class="actions">${DB.isAdmin() ? `<button class="btn btn-sm" data-act="editM" data-id="${m.id}">编辑</button><button class="btn btn-sm btn-danger" data-act="delM" data-id="${m.id}">删除</button>` : "—"}</td>
    </tr>`).join("");

    view.innerHTML = page("成员管理",
      `<div class="row-actions">${DB.isAdmin() ? `<button class="btn btn-primary" id="addM">+ 添加成员</button>` : ""}<span class="muted">共 ${ms.length} 人</span></div>
       <div class="panel"><table class="tbl"><thead><tr><th>姓名</th><th>学号</th><th>身份</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`
    );

    if (DB.isAdmin()) {
      $("#addM").onclick = () => memberForm();
      view.querySelectorAll("[data-act='editM']").forEach((b) => (b.onclick = () => memberForm(b.dataset.id)));
      view.querySelectorAll("[data-act='delM']").forEach((b) => (b.onclick = () => {
        if (confirm("确认删除该成员？")) { DB.removeMember(b.dataset.id); toast("已删除"); renderMembers(); }
      }));
    }
  }

  function memberForm(id) {
    const m = id ? DB.getMembers().find((x) => x.id === id) : null;
    openModal(id ? "编辑成员" : "添加成员", `
      <label class="field"><span>姓名</span><input id="f-name" value="${esc(m ? m.name : "")}" /></label>
      <label class="field"><span>学号</span><input id="f-no" value="${esc(m ? m.student_no : "")}" /></label>
      <label class="field"><span>身份</span><select id="f-admin"><option value="false" ${m && !m.isAdmin ? "selected" : ""}>成员</option><option value="true" ${m && m.isAdmin ? "selected" : ""}>班委</option></select></label>
      <label class="field"><span>状态</span><select id="f-status"><option value="active" ${!m || m.status === "active" ? "selected" : ""}>在读</option><option value="graduated" ${m && m.status === "graduated" ? "selected" : ""}>已毕业</option></select></label>
      <button class="btn btn-primary btn-block" id="f-save">保存</button>
    `);
    $("#f-save").onclick = () => {
      const data = {
        name: $("#f-name").value.trim() || "未命名",
        student_no: $("#f-no").value.trim(),
        isAdmin: $("#f-admin").value === "true",
        status: $("#f-status").value
      };
      if (m) DB.updateMember(m.id, data); else DB.addMember(data);
      closeModal(); toast("已保存"); renderMembers();
    };
  }

  // ---------- 收缴 ----------
  function renderIncome() {
    const inc = DB.getIncomes();
    const paid = inc.filter((i) => i.paid);
    const unpaid = inc.filter((i) => !i.paid);
    const sumPaid = paid.reduce((s, i) => s + Number(i.amount), 0);
    const sumUnpaid = unpaid.reduce((s, i) => s + Number(i.amount), 0);

    const rows = inc.slice().sort((a, b) => (b.payDate || "0").localeCompare(a.payDate || "0")).map((i) => `<tr>
      <td>${esc(memberName(i.memberId))}</td><td>¥${money(i.amount)}</td>
      <td>${i.paid ? `<span class="badge b-income">已缴</span>` : `<span class="badge b-expense">未缴</span>`}</td>
      <td>${esc(i.method || "—")}</td><td>${esc(i.handler || "—")}</td><td>${esc(i.payDate || "—")}</td>
      <td class="actions">${DB.isAdmin() ? (!i.paid ? `<button class="btn btn-sm" data-act="pay" data-id="${i.id}">标记已缴</button>` : "") + `<button class="btn btn-sm" data-act="editI" data-id="${i.id}">编辑</button><button class="btn btn-sm btn-danger" data-act="delI" data-id="${i.id}">删除</button>` : "—"}</td>
    </tr>`).join("");

    const owed = unpaid.length
      ? `<div class="panel"><h3>催缴名单（${unpaid.length} 笔未缴，合计 ¥${money(sumUnpaid)}）</h3>
          <ul class="owe-list">${unpaid.map((i) => `<li>${esc(memberName(i.memberId))} · ¥${money(i.amount)} <span class="muted">${esc(i.note || "")}</span></li>`).join("")}</ul></div>`
      : "";

    view.innerHTML = page("班费收缴", `
      <div class="cards">
        <div class="stat"><div class="stat-label">已收</div><div class="stat-num pos">¥${money(sumPaid)}</div></div>
        <div class="stat"><div class="stat-label">未收</div><div class="stat-num neg">¥${money(sumUnpaid)}</div></div>
        <div class="stat"><div class="stat-label">记录数</div><div class="stat-num">${inc.length}</div></div>
      </div>
      <div class="row-actions">${DB.isAdmin() ? `<button class="btn btn-primary" id="bulk">批量生成收缴</button><button class="btn btn-primary" id="addI">+ 单笔收缴</button>` : ""}</div>
      ${owed}
      <div class="panel"><h3>收缴记录</h3><div class="tbl-scroll"><table class="tbl"><thead><tr><th>成员</th><th>金额</th><th>状态</th><th>方式</th><th>经手人</th><th>日期</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    `);

    if (DB.isAdmin()) {
      $("#bulk").onclick = () => {
        openModal("批量生成收缴", `
          <p class="muted">将为每位在读成员生成一条未缴记录，之后逐条标记已缴。</p>
          <label class="field"><span>每人金额</span><input id="b-amt" type="number" min="0" step="0.01" placeholder="如 50" /></label>
          <label class="field"><span>备注</span><input id="b-note" placeholder="如 2026秋季班费" /></label>
          <button class="btn btn-primary btn-block" id="b-save">生成</button>
        `);
        $("#b-save").onclick = () => {
          const amt = parseFloat($("#b-amt").value);
          if (!(amt > 0)) return toast("请输入有效金额");
          DB.bulkCreateIncome(amt, $("#b-note").value.trim());
          closeModal(); toast("已生成收缴记录"); renderIncome();
        };
      };
      $("#addI").onclick = () => incomeForm();
      view.querySelectorAll("[data-act='pay']").forEach((b) => (b.onclick = () => {
        const id = b.dataset.id;
        openModal("标记已缴", `
          <label class="field"><span>缴纳方式</span><select id="p-method"><option>微信</option><option>支付宝</option><option>现金</option><option>银行</option></select></label>
          <label class="field"><span>经手人</span><input id="p-handler" placeholder="班委姓名" /></label>
          <button class="btn btn-primary btn-block" id="p-save">确认已缴</button>
        `);
        $("#p-save").onclick = () => {
          DB.updateIncome(id, { paid: true, payDate: DB.today(), method: $("#p-method").value, handler: $("#p-handler").value.trim() });
          closeModal(); toast("已标记已缴"); renderIncome();
        };
      }));
      view.querySelectorAll("[data-act='editI']").forEach((b) => (b.onclick = () => incomeForm(b.dataset.id)));
      view.querySelectorAll("[data-act='delI']").forEach((b) => (b.onclick = () => {
        if (confirm("确认删除该收缴记录？")) { DB.removeIncome(b.dataset.id); toast("已删除"); renderIncome(); }
      }));
    }
  }

  function incomeForm(id) {
    const i = id ? DB.getIncomes().find((x) => x.id === id) : null;
    const opts = DB.getMembers().map((m) => `<option value="${m.id}" ${i && i.memberId === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("");
    openModal(id ? "编辑收缴" : "添加单笔收缴", `
      <label class="field"><span>成员</span><select id="i-mem">${opts}</select></label>
      <label class="field"><span>金额</span><input id="i-amt" type="number" min="0" step="0.01" value="${i ? i.amount : ""}" /></label>
      <label class="field"><span>方式</span><input id="i-method" value="${esc(i ? i.method : "")}" placeholder="微信/现金…" /></label>
      <label class="field"><span>经手人</span><input id="i-handler" value="${esc(i ? i.handler : "")}" /></label>
      <label class="field"><span>日期</span><input id="i-date" type="date" value="${i && i.payDate ? i.payDate : DB.today()}" /></label>
      <label class="field"><span>备注</span><input id="i-note" value="${esc(i ? i.note : "")}" /></label>
      <label class="field check"><input type="checkbox" id="i-paid" ${i && i.paid ? "checked" : ""}/> 已缴</label>
      <button class="btn btn-primary btn-block" id="i-save">保存</button>
    `);
    $("#i-save").onclick = () => {
      const amt = parseFloat($("#i-amt").value);
      if (!(amt >= 0)) return toast("请输入有效金额");
      const paid = $("#i-paid").checked;
      const data = {
        memberId: $("#i-mem").value, amount: amt,
        method: $("#i-method").value.trim(), handler: $("#i-handler").value.trim(),
        payDate: paid ? $("#i-date").value : null, note: $("#i-note").value.trim(), paid
      };
      if (i) DB.updateIncome(i.id, data); else DB.addIncome(data);
      closeModal(); toast("已保存"); renderIncome();
    };
  }

  // ---------- 支出 ----------
  function renderExpense() {
    const ex = DB.getExpenses().slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const rows = ex.map((e) => `<tr>
      <td>${esc(e.date)}</td><td>${esc(e.purpose)}</td><td>${esc(catName(e.categoryId))}</td>
      <td class="neg">¥${money(e.amount)}</td><td>${esc(e.handler || "—")}</td>
      <td>${e.receipt ? `<a href="#" class="link" data-act="viewR" data-id="${e.id}">凭证</a>` : "—"}</td>
      <td class="actions">${DB.isAdmin() ? `<button class="btn btn-sm btn-danger" data-act="delE" data-id="${e.id}">删除</button>` : "—"}</td>
    </tr>`).join("");

    view.innerHTML = page("支出记录", `
      <div class="row-actions">${DB.isAdmin() ? `<button class="btn btn-primary" id="addE">+ 记一笔支出</button>` : ""}<span class="muted">累计支出 ¥${money(DB.totals().expense)}</span></div>
      <div class="panel"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>日期</th><th>用途</th><th>分类</th><th>金额</th><th>经手人</th><th>凭证</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    `);

    if (DB.isAdmin()) {
      $("#addE").onclick = () => expenseForm();
      view.querySelectorAll("[data-act='delE']").forEach((b) => (b.onclick = () => {
        if (confirm("确认删除该支出？（将保留为作废痕迹）")) { DB.removeExpense(b.dataset.id); toast("已删除"); renderExpense(); }
      }));
    }
    view.querySelectorAll("[data-act='viewR']").forEach((b) => (b.onclick = (ev) => {
      ev.preventDefault();
      const e = DB.getExpenses().find((x) => x.id === b.dataset.id);
      openModal("支出凭证", `<img src="${e.receipt}" style="max-width:100%" />`);
    }));
  }

  function expenseForm() {
    const cats = DB.getCategories().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
    openModal("记一笔支出", `
      <label class="field"><span>金额</span><input id="e-amt" type="number" min="0" step="0.01" placeholder="0.00" /></label>
      <label class="field"><span>日期</span><input id="e-date" type="date" value="${DB.today()}" /></label>
      <label class="field"><span>分类</span><select id="e-cat">${cats}</select></label>
      <label class="field"><span>用途</span><input id="e-purpose" placeholder="如 班级聚餐" /></label>
      <label class="field"><span>经手人</span><input id="e-handler" placeholder="班委姓名" /></label>
      <label class="field"><span>凭证图片</span><input id="e-receipt" type="file" accept="image/*" /></label>
      <label class="field"><span>备注</span><input id="e-note" /></label>
      <button class="btn btn-primary btn-block" id="e-save">保存</button>
    `);
    $("#e-save").onclick = () => {
      const amt = parseFloat($("#e-amt").value);
      if (!(amt > 0)) return toast("请输入有效金额");
      const file = $("#e-receipt").files[0];
      const finish = (receipt) => {
        DB.addExpense({
          amount: amt, date: $("#e-date").value, categoryId: $("#e-cat").value,
          purpose: $("#e-purpose").value.trim() || "未填写", handler: $("#e-handler").value.trim(),
          receipt, note: $("#e-note").value.trim()
        });
        closeModal(); toast("已记账"); renderExpense();
      };
      if (file) {
        if (file.size > 1500000) return toast("图片过大（>1.5MB），请压缩后上传");
        const r = new FileReader();
        r.onload = () => finish(r.result);
        r.readAsDataURL(file);
      } else finish(null);
    };
  }

  // ---------- 流水 ----------
  function renderLedger() {
    const flow = [
      ...DB.getIncomes().filter((i) => i.paid).map((i) => ({ type: "收入", date: i.payDate, who: memberName(i.memberId), cat: "班费收缴", amt: i.amount, handler: i.handler })),
      ...DB.getExpenses().map((e) => ({ type: "支出", date: e.date, who: e.purpose, cat: catName(e.categoryId), amt: -e.amount, handler: e.handler }))
    ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const types = `<select id="f-type"><option value="">全部类型</option><option>收入</option><option>支出</option></select>`;
    const rows = flow.map((r) => `<tr><td>${esc(r.date)}</td><td><span class="badge ${r.type === "收入" ? "b-income" : "b-expense"}">${r.type}</span></td><td>${esc(r.who)}</td><td>${esc(r.cat)}</td><td class="${r.amt < 0 ? "neg" : "pos"}">${r.amt < 0 ? "-" : "+"}${money(Math.abs(r.amt))}</td><td>${esc(r.handler || "—")}</td></tr>`).join("");

    view.innerHTML = page("收支流水", `
      <div class="row-actions">${types}<button class="btn btn-ghost" id="exp">导出 CSV</button></div>
      <div class="panel"><div class="tbl-scroll"><table class="tbl"><thead><tr><th>日期</th><th>类型</th><th>摘要</th><th>分类</th><th>金额</th><th>经手人</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    `);
    $("#exp").onclick = () => {
      const head = "类型,日期,摘要,分类,金额,经手人\n";
      const body = flow.map((r) => `${r.type},${r.date},${esc(r.who)},${r.cat},${r.amt},${esc(r.handler || "")}`).join("\n");
      downloadCSV("班费流水.csv", head + body);
      toast("已导出 CSV");
    };
  }

  // ---------- 报表 ----------
  function renderReports() {
    const t = DB.totals();
    const byCat = {};
    DB.getExpenses().forEach((e) => { byCat[e.categoryId] = (byCat[e.categoryId] || 0) + Number(e.amount); });
    const pie = Object.keys(byCat).map((id) => ({ label: catName(id), value: byCat[id] }));
    const palette = ["#2471a3", "#1e8449", "#e67e22", "#8e44ad", "#c0392b", "#16a085", "#7f8c8d"];
    pie.forEach((p, i) => (p.color = palette[i % palette.length]));

    const memberPaid = DB.getMembers().map((m) => {
      const sum = DB.getIncomes().filter((i) => i.memberId === m.id && i.paid).reduce((s, i) => s + Number(i.amount), 0);
      return { name: m.name, sum };
    });

    view.innerHTML = page("统计报表", `
      <div class="cards">
        <div class="stat"><div class="stat-label">当前余额</div><div class="stat-num">¥${money(t.balance)}</div></div>
        <div class="stat"><div class="stat-label">已收</div><div class="stat-num pos">¥${money(t.paidIncome)}</div></div>
        <div class="stat"><div class="stat-label">支出</div><div class="stat-num neg">¥${money(t.expense)}</div></div>
      </div>
      <div class="grid-2">
        <div class="panel"><h3>支出分类占比</h3>
          ${pie.length ? `<canvas id="pie" width="240" height="240"></canvas><ul class="legend">${pie.map((p) => `<li><span class="dot" style="background:${p.color}"></span>${esc(p.label)} ¥${money(p.value)}</li>`).join("")}</ul>` : '<p class="empty">暂无支出</p>'}
        </div>
        <div class="panel"><h3>成员已缴情况</h3>
          <ul class="owe-list">${memberPaid.map((m) => `<li>${esc(m.name)} · 已缴 ¥${money(m.sum)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="row-actions"><button class="btn btn-ghost" id="exp2">导出流水 CSV</button></div>
    `);

    if (pie.length) drawPie($("#pie"), pie);
    $("#exp2").onclick = () => {
      const flow = [
        ...DB.getIncomes().filter((i) => i.paid).map((i) => ({ type: "收入", date: i.payDate, who: memberName(i.memberId), cat: "班费收缴", amt: i.amount })),
        ...DB.getExpenses().map((e) => ({ type: "支出", date: e.date, who: e.purpose, cat: catName(e.categoryId), amt: -e.amount }))
      ];
      const head = "类型,日期,摘要,分类,金额\n";
      const body = flow.map((r) => `${r.type},${r.date},${esc(r.who)},${r.cat},${r.amt}`).join("\n");
      downloadCSV("班费流水.csv", head + body);
    };
  }

  function drawPie(canvas, data) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const ctx = canvas.getContext("2d");
    let start = -Math.PI / 2;
    ctx.clearRect(0, 0, 240, 240);
    data.forEach((d) => {
      const ang = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(120, 120);
      ctx.arc(120, 120, 100, start, start + ang);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += ang;
    });
    ctx.beginPath();
    ctx.arc(120, 120, 55, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.fillStyle = "#1b2631";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("¥" + money(total), 120, 118);
    ctx.fillText("支出", 120, 136);
  }

  // ---------- 设置 ----------
  function renderSettings() {
    const cats = DB.getCategories().map((c) => `<li>${esc(c.name)} ${DB.isAdmin() ? `<button class="btn btn-sm btn-danger" data-act="delC" data-id="${c.id}">删</button>` : ""}</li>`).join("");
    view.innerHTML = page("设置", `
      <div class="panel"><h3>支出分类</h3>
        <ul class="owe-list">${cats}</ul>
        ${DB.isAdmin() ? `<div class="row-actions"><input id="newCat" placeholder="新分类名" /><button class="btn btn-primary" id="addCat">添加</button></div>` : ""}
      </div>
      <div class="panel"><h3>数据</h3>
        <p class="muted">演示数据保存在本机浏览器（localStorage）。切换设备或更换浏览器不会同步。</p>
        ${DB.isAdmin() ? `<button class="btn btn-danger" id="reset">重置为示例数据</button>` : ""}
      </div>
    `);
    if (DB.isAdmin()) {
      $("#addCat").onclick = () => {
        const n = $("#newCat").value.trim();
        if (n) { DB.addCategory(n, "expense"); toast("已添加"); renderSettings(); }
      };
      view.querySelectorAll("[data-act='delC']").forEach((b) => (b.onclick = () => {
        DB.removeCategory(b.dataset.id); toast("已删除"); renderSettings();
      }));
      $("#reset").onclick = () => {
        if (confirm("确认清空并重置为示例数据？")) { DB.reset(); toast("已重置"); route(); }
      };
    }
  }

  // ---------- 启动 ----------
  window.APP = { go: (h) => (location.hash = "#" + h) };
  $("#modal-close").onclick = closeModal;
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  window.addEventListener("hashchange", route);
  initLogin();
})();
