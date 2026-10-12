// 班费管理 · 数据存储层（localStorage 持久化，演示用）
// 全部数据存于浏览器 localStorage，无需后端。

const DB = (() => {
  const KEY = "class_fee_db_v1";

  function uid() {
    return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function seed() {
    const members = [
      { id: uid(), name: "班长", student_no: "2021001", isAdmin: true, status: "active" },
      { id: uid(), name: "生活委员", student_no: "2021002", isAdmin: true, status: "active" },
      { id: uid(), name: "张三", student_no: "2021003", isAdmin: false, status: "active" },
      { id: uid(), name: "李四", student_no: "2021004", isAdmin: false, status: "active" },
      { id: uid(), name: "王五", student_no: "2021005", isAdmin: false, status: "active" },
      { id: uid(), name: "赵六", student_no: "2021006", isAdmin: false, status: "active" }
    ];
    return {
      members,
      incomes: [],
      expenses: [],
      categories: [
        { id: uid(), name: "活动", type: "expense" },
        { id: uid(), name: "物资采购", type: "expense" },
        { id: uid(), name: "聚餐", type: "expense" },
        { id: uid(), name: "打印", type: "expense" },
        { id: uid(), name: "慰问", type: "expense" },
        { id: uid(), name: "其他", type: "expense" }
      ],
      user: null,
      approvalThreshold: 200
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return seed();
      const d = JSON.parse(raw);
      if (!d.members) return seed();
      return d;
    } catch (e) {
      return seed();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // ---- 用户 / 权限 ----
  function setUser(user) { state.user = user; save(); }
  function getUser() { return state.user; }
  function isAdmin() { return !!(state.user && state.user.isAdmin); }

  // ---- 成员 ----
  function getMembers() { return state.members; }
  function addMember(m) { state.members.push({ id: uid(), status: "active", isAdmin: false, ...m }); save(); }
  function updateMember(id, patch) {
    const i = state.members.findIndex((x) => x.id === id);
    if (i >= 0) { state.members[i] = { ...state.members[i], ...patch }; save(); }
  }
  function removeMember(id) { state.members = state.members.filter((x) => x.id !== id); save(); }

  // ---- 收缴（收入）----
  function getIncomes() { return state.incomes; }
  function addIncome(rec) { state.incomes.push({ id: uid(), paid: false, ...rec }); save(); }
  function updateIncome(id, patch) {
    const i = state.incomes.findIndex((x) => x.id === id);
    if (i >= 0) { state.incomes[i] = { ...state.incomes[i], ...patch }; save(); }
  }
  function removeIncome(id) { state.incomes = state.incomes.filter((x) => x.id !== id); save(); }

  // 批量生成收缴：为每位在读成员创建一条未缴记录
  function bulkCreateIncome(amount, note) {
    state.members.filter((m) => m.status === "active").forEach((m) => {
      state.incomes.push({ id: uid(), memberId: m.id, amount: Number(amount), payDate: null, method: "", handler: "", paid: false, note: note || "班费收缴" });
    });
    save();
  }

  // ---- 支出 ----
  function getExpenses() { return state.expenses; }
  function addExpense(rec) { state.expenses.push({ id: uid(), date: today(), ...rec }); save(); }
  function removeExpense(id) { state.expenses = state.expenses.filter((x) => x.id !== id); save(); }

  // ---- 分类 ----
  function getCategories() { return state.categories; }
  function addCategory(name, type) { state.categories.push({ id: uid(), name, type: type || "expense" }); save(); }
  function removeCategory(id) { state.categories = state.categories.filter((x) => x.id !== id); save(); }

  // ---- 统计 ----
  function totals() {
    const paidIncome = state.incomes.filter((i) => i.paid).reduce((s, i) => s + Number(i.amount), 0);
    const expense = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return { paidIncome, expense, balance: paidIncome - expense };
  }

  function reset() { state = seed(); save(); }

  return {
    uid, today,
    setUser, getUser, isAdmin,
    getMembers, addMember, updateMember, removeMember,
    getIncomes, addIncome, updateIncome, removeIncome, bulkCreateIncome,
    getExpenses, addExpense, removeExpense,
    getCategories, addCategory, removeCategory,
    totals, reset, save
  };
})();
