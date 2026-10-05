import { supabase, supabaseConfigured } from "./supabase.js";

const defaultHabits = [
  { id: 1, name: "Morning movement", meta: "20 min · Wellness", emoji: "🏃", time: "7:30 AM", done: true },
  { id: 2, name: "Deep work session", meta: "90 min · Focus", emoji: "◒", time: "9:00 AM", done: true },
  { id: 3, name: "Read & reflect", meta: "20 min · Learning", emoji: "📖", time: "6:00 PM", done: true },
  { id: 4, name: "Plan tomorrow", meta: "5 min · Personal", emoji: "✎", time: "8:30 PM", done: false },
  { id: 5, name: "Drink 8 glasses", meta: "Daily · Wellness", emoji: "◌", time: "All day", done: false }
];
const defaultActivity = [
  { id: 1, name: "Morning movement", category: "Wellness", date: "Today, 7:42 AM", status: "Completed" },
  { id: 2, name: "Deep work session", category: "Focus", date: "Today, 10:31 AM", status: "Completed" },
  { id: 3, name: "Read & reflect", category: "Learning", date: "Yesterday, 6:18 PM", status: "Completed" },
  { id: 4, name: "Weekly review", category: "Personal", date: "Yesterday, 8:04 AM", status: "Completed" }
];

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(`progress-${key}`)) ?? fallback; } catch (error) { return fallback; }
  },
  set(key, value) { localStorage.setItem(`progress-${key}`, JSON.stringify(value)); }
};
const accountStoreKey = "accounts";
const localAuthKey = "local-auth";
const defaultProfile = { name: "Alex Kim", email: "alex@example.com", workspace: "Personal workspace" };
const legacyHabits = store.get("habits", defaultHabits);
const legacyActivity = store.get("activity", defaultActivity);
const legacyLog = store.get("completion-log", {});
let accounts = store.get(accountStoreKey, null);
if (!accounts) {
  const firstId = `account-${Date.now()}`;
  accounts = { activeId: firstId, records: { [firstId]: { profile: defaultProfile, habits: legacyHabits, activity: legacyActivity, completionLog: legacyLog, selectedMonth: new Date().toISOString().slice(0, 7), theme: localStorage.getItem("progress-theme") || "dark" } } };
  store.set(accountStoreKey, accounts);
}
let activeAccount = accounts.records[accounts.activeId] || accounts.records[Object.keys(accounts.records)[0]];
accounts.activeId = Object.keys(accounts.records).find((id) => accounts.records[id] === activeAccount);
let habits = activeAccount.habits;
let activity = activeAccount.activity;
let completionLog = activeAccount.completionLog;
let selectedMonth = activeAccount.selectedMonth;
let localAuth = store.get(localAuthKey, { sessionEmail: null, users: {} });
let creatingWorkspace = false;
const $ = (selector) => document.querySelector(selector);

function categoryClass(category) { return `tag-${category.toLowerCase()}`; }
function persistAccount() {
  activeAccount.habits = habits; activeAccount.activity = activity; activeAccount.completionLog = completionLog; activeAccount.selectedMonth = selectedMonth;
  accounts.records[accounts.activeId] = activeAccount; store.set(accountStoreKey, accounts);
  if (supabaseConfigured && supabase) {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      return supabase.from("user_workspaces").upsert({
        user_id: data.user.id,
        workspace_id: accounts.activeId,
        payload: activeAccount,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,workspace_id" });
    }).catch((error) => console.error("Cloud sync failed:", error));
  }
}
function renderProfile() {
  const { name, email, workspace } = activeAccount.profile;
  $("#profileName").textContent = name; $("#profileWorkspace").textContent = workspace;
  $("#profileAvatar").textContent = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  $("#menuName").textContent = name; $("#menuEmail").textContent = email || "Local demo account";
  $("#menuAvatar").textContent = $("#profileAvatar").textContent;
  $("#menuThemeLabel").textContent = activeAccount.theme === "light" ? "Light theme" : "Dark theme";
  const preferences = activeAccount.preferences || { density: "comfortable", reduceMotion: false, startView: "overview", weekStart: "monday", notifications: true, reminderTime: "20:00" };
  $("#settingsTheme").value = activeAccount.theme || "dark";
  $("#settingsDensity").value = preferences.density;
  $("#settingsStartView").value = preferences.startView;
  $("#settingsWeekStart").value = preferences.weekStart;
  $("#settingsMotion").checked = preferences.reduceMotion;
  $("#settingsNotifications").checked = preferences.notifications !== false;
  $("#settingsReminderTime").value = preferences.reminderTime || "20:00";
  updateReminderTimeHelp(preferences.reminderTime || "20:00");
  document.body.classList.toggle("compact-layout", preferences.density === "compact");
  document.body.classList.toggle("reduce-motion", preferences.reduceMotion);
  renderWelcome(name);
}
function updateReminderTimeHelp(time) {
  const [hour, minute] = time.split(":").map(Number);
  const label = new Date(2000, 0, 1, hour, minute).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  $("#reminderTimeHelp").textContent = `You’ll be reminded every day at ${label} when habits are unfinished`;
}
function renderWelcome(name) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#welcomeGreeting").textContent = greeting;
  $("#welcomeName").textContent = name || "there";
  $("#welcomeName").setAttribute("title", `Signed in as ${name || "there"}`);
  $(".eyebrow").textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (selectedMonth !== currentMonth && document.querySelector("#monthSelect")) {
    selectedMonth = currentMonth;
    $("#monthSelect").value = currentMonth;
    persistAccount();
    renderStats();
    renderPerformanceTrend();
  }
}
window.setInterval(() => renderWelcome(activeAccount.profile.name), 60000);
function renderPerformanceTrend(period = document.querySelector(".trend-switch.active")?.dataset.trendPeriod || "month") {
  const year = Number(selectedMonth.slice(0, 4));
  const month = Number(selectedMonth.slice(5, 7));
  const days = new Date(year, month, 0).getDate();
  const values = [];
  const labels = [];
  if (period === "year") {
    for (let index = 0; index < 12; index += 1) {
      const monthKey = `${year}-${String(index + 1).padStart(2, "0")}`;
      const entries = completionLog[monthKey] || [];
      const daysInMonth = new Date(year, index + 1, 0).getDate();
      values.push(habits.length ? Math.min(100, Math.round((entries.length / (habits.length * daysInMonth)) * 100)) : 0);
      labels.push(new Date(year, index, 1).toLocaleDateString("en-US", { month: "short" }));
    }
    $("#trendPeriodLabel").textContent = `${year} overview`;
  } else {
    const entries = completionLog[selectedMonth] || [];
    for (let day = 1; day <= days; day += 1) {
      const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
      const completed = entries.filter((entry) => entry.date === date).length;
      values.push(habits.length ? Math.min(100, Math.round((completed / habits.length) * 100)) : 0);
      labels.push(String(day));
    }
    $("#trendPeriodLabel").textContent = monthLabel(selectedMonth);
  }
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 600},${180 - value * 1.8}`).join(" ");
  $("#performanceTrendLine").setAttribute("points", points || "0,180 600,180");
  $("#performanceTrendFill").setAttribute("d", points ? `M${points.replace(/ /g, " L")} L600,180 L0,180Z` : "M0,180 L600,180Z");
  $("#trendXAxis").innerHTML = [0, Math.floor((labels.length - 1) / 2), Math.max(0, labels.length - 1)].map((index) => `<span>${labels[index] || ""}</span>`).join("");
  document.querySelectorAll(".trend-switch").forEach((button) => button.classList.toggle("active", button.dataset.trendPeriod === period));
}
function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function setupMonthSelect() {
  const select = $("#monthSelect");
  const current = new Date();
  select.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return `<option value="${value}">${monthLabel(value)}</option>`;
  }).join("");
  select.value = selectedMonth;
  select.addEventListener("change", () => {
    selectedMonth = select.value;
    persistAccount();
    renderStats();
    renderPerformanceTrend();
    showToast(`Showing ${monthLabel(selectedMonth)}`);
  });
}
function showToast(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}
function renderStats() {
  const monthEntries = completionLog[selectedMonth] || [];
  const completions = monthEntries.length;
  const activeDays = new Set(monthEntries.map((entry) => entry.date)).size;
  const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();
  const possible = Math.max(1, habits.length * Math.min(daysInMonth, new Date().getDate()));
  const score = Math.min(100, Math.round((completions / possible) * 100));
  $("#weeklyScore").textContent = score;
  $("#scoreBar").style.width = `${score}%`;
  $("#streakValue").textContent = completions;
  $("#completedValue").textContent = activeDays;
  $("#completedNote").textContent = activeDays ? `${activeDays} active day${activeDays === 1 ? "" : "s"} this month` : "No check-ins yet";
}
function renderPerformance() {
  const completed = habits.filter((habit) => habit.done).length;
  const remaining = Math.max(0, habits.length - completed);
  const percentage = habits.length ? Math.round((completed / habits.length) * 100) : 0;
  const pie = $("#performancePie");
  pie.style.setProperty("--completed-angle", `${percentage * 3.6}deg`);
  pie.setAttribute("aria-label", `${percentage} percent of habits completed: ${completed} completed, ${remaining} remaining`);
  $("#performancePercent").textContent = `${percentage}%`;
  $("#performanceCompleted").textContent = completed;
  $("#performanceRemaining").textContent = remaining;
  $("#performanceBadge").textContent = `${percentage}% today`;
  $("#performanceMessage").textContent = percentage === 100
    ? "Excellent work. You completed every habit today."
    : percentage
      ? "You are building momentum. Keep your streak going."
      : "Check off a habit to see your performance.";
  renderPerformanceTrend();
}
function recordCompletion(habitId, done) {
  const month = new Date().toISOString().slice(0, 7);
  const date = new Date().toISOString().slice(0, 10);
  const entries = completionLog[month] || [];
  const existing = entries.findIndex((entry) => entry.habitId === habitId && entry.date === date);
  if (done && existing === -1) entries.push({ habitId, date });
  if (!done && existing !== -1) entries.splice(existing, 1);
  completionLog[month] = entries;
  persistAccount();
}
function renderHabits() {
  const list = $("#habitList");
  list.innerHTML = habits.map((habit) => `<div class="habit-row ${habit.done ? "done" : ""}">
    <button class="habit-check" data-habit="${habit.id}" aria-label="${habit.done ? "Unmark" : "Mark"} ${habit.name}">${habit.done ? "✓" : ""}</button>
    <span class="habit-emoji">${habit.emoji}</span><div class="habit-info"><div class="habit-name">${habit.name}</div><div class="habit-meta">${habit.meta}</div></div><span class="habit-time">${habit.time}</span><button class="habit-remove" data-remove-habit="${habit.id}" aria-label="Remove ${habit.name}" title="Remove habit">×</button>
  </div>`).join("");
  const complete = habits.filter((habit) => habit.done).length;
  $("#habitSummary").textContent = `${complete} of ${habits.length} complete`;
  $("#checkAll").innerHTML = complete === habits.length ? "<span>↶</span> Reset today" : "<span>✓</span> Mark all complete";
  renderStats();
  renderPerformance();
  document.querySelectorAll("[data-habit]").forEach((button) => button.addEventListener("click", () => {
    const habitId = Number(button.dataset.habit);
    const nextDone = !habits.find((habit) => habit.id === habitId).done;
    habits = habits.map((habit) => habit.id === habitId ? { ...habit, done: nextDone } : habit);
    recordCompletion(habitId, nextDone);
    persistAccount(); renderHabits(); showToast("Habit progress updated");
  }));
  document.querySelectorAll("[data-remove-habit]").forEach((button) => button.addEventListener("click", () => {
    const habitId = Number(button.dataset.removeHabit);
    const habit = habits.find((item) => item.id === habitId);
    if (!habit || !window.confirm(`Remove "${habit.name}" from your habits?`)) return;
    habits = habits.filter((item) => item.id !== habitId);
    Object.keys(completionLog).forEach((month) => {
      completionLog[month] = completionLog[month].filter((entry) => entry.habitId !== habitId);
    });
    persistAccount();
    renderHabits();
    showToast(`${habit.name} removed`);
  }));
}
function renderActivity(filter = "") {
  const body = $("#activityBody");
  const visible = activity.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(filter.toLowerCase()));
  $("#emptyState").hidden = visible.length > 0;
  body.innerHTML = visible.map((item) => `<tr data-activity="${item.id}"><td><span class="activity-name">${item.name}</span></td><td><span class="category-tag ${categoryClass(item.category)}">${item.category}</span></td><td class="activity-date">${item.date}</td><td><span class="status"><i></i>${item.status}</span></td><td><button class="row-menu" data-remove="${item.id}" aria-label="Remove activity">•••</button></td></tr>`).join("");
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    const row = document.querySelector(`[data-activity="${button.dataset.remove}"]`);
    row.classList.add("removing");
    window.setTimeout(() => { activity = activity.filter((item) => item.id !== Number(button.dataset.remove)); persistAccount(); renderActivity($("#searchInput").value); showToast("Activity removed"); }, 250);
  }));
}
function openModal() { $("#goalModal").hidden = false; $("#goalName").focus(); }
function closeModal() { $("#goalModal").hidden = true; $("#goalForm").reset(); }
function openAccount() {
  $("#accountName").value = activeAccount.profile.name; $("#accountEmail").value = activeAccount.profile.email; $("#workspaceName").value = activeAccount.profile.workspace;
  renderProfile();
  $("#accountModal").hidden = false; $("#accountName").focus();
}
function closeAccount() { creatingWorkspace = false; $("#accountModal").hidden = true; }
function toggleProfileMenu(force) {
  const menu = $("#profileMenu");
  const open = typeof force === "boolean" ? force : menu.hidden;
  menu.hidden = !open;
  $("#profileButton").setAttribute("aria-expanded", String(open));
}
function toggleTheme() {
  document.body.classList.toggle("dark");
  activeAccount.theme = document.body.classList.contains("dark") ? "dark" : "light";
  persistAccount(); renderProfile();
  showToast(`${activeAccount.theme === "dark" ? "Dark" : "Light"} theme enabled`);
}
async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Notifications are not supported in this browser");
    return false;
  }
  if (Notification.permission === "granted") return true;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") showToast("Notification permission was not granted");
  return permission === "granted";
}
async function scheduleNativeReminder() {
  if (!globalThis.Capacitor?.isNativePlatform?.() || activeAccount.preferences?.notifications === false) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return;
    const [hour, minute] = (activeAccount.preferences?.reminderTime || "20:00").split(":").map(Number);
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: 1001,
        title: "progress.io reminder",
        body: "You still have unfinished habits today.",
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        smallIcon: "ic_stat_icon_config_sample"
      }]
    });
  } catch (error) {
    console.error("Native notification scheduling failed:", error);
  }
}
async function cancelNativeReminder() {
  if (!globalThis.Capacitor?.isNativePlatform?.()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
  } catch (error) {
    console.error("Native notification cancellation failed:", error);
  }
}
function checkDailyReminder() {
  const preferences = activeAccount.preferences || {};
  if (preferences.notifications === false || !("Notification" in window) || Notification.permission !== "granted") return;
  const incomplete = habits.filter((habit) => !habit.done).length;
  if (!incomplete) return;
  const now = new Date();
  const [hour, minute] = (preferences.reminderTime || "20:00").split(":").map(Number);
  const dateKey = now.toISOString().slice(0, 10);
  const due = now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
  if (!due || activeAccount.lastReminderDate === dateKey) return;
  new Notification("Progress reminder", { body: `${incomplete} habit${incomplete === 1 ? "" : "s"} still waiting for you today.`, tag: "progress-daily-reminder" });
  activeAccount.lastReminderDate = dateKey;
  persistAccount();
}
async function logout() {
  toggleProfileMenu(false);
  if (supabaseConfigured && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) { showToast("Could not log out. Try again."); return; }
    $("#authModal").hidden = false;
    setAuthStatus("You have been logged out.");
  } else {
    localAuth.sessionEmail = null;
    store.set(localAuthKey, localAuth);
    $("#authModal").hidden = false;
    authSignUp = false;
    $("#authMode").textContent = "Create account";
    $("#authSubmit").textContent = "Sign in";
    setAuthStatus("You have been logged out. Sign in or create a local account.");
  }
}
function createAccount() {
  creatingWorkspace = true;
  $("#accountName").value = "";
  $("#accountEmail").value = "";
  $("#workspaceName").value = "";
  $("#accountModal").hidden = false;
  $("#accountName").focus();
}

setupMonthSelect();
if (!completionLog[selectedMonth]) {
  completionLog[selectedMonth] = habits.filter((habit) => habit.done).map((habit) => ({ habitId: habit.id, date: new Date().toISOString().slice(0, 10) }));
  store.set("completion-log", completionLog);
}
renderHabits(); renderActivity();
$("#checkAll").addEventListener("click", () => {
  const complete = habits.every((habit) => habit.done);
  habits = habits.map((habit) => ({ ...habit, done: !complete }));
  habits.forEach((habit) => recordCompletion(habit.id, !complete));
  persistAccount(); renderHabits(); showToast(complete ? "Habits reset for today" : "All habits marked complete");
});
$("#searchInput").addEventListener("input", (event) => renderActivity(event.target.value));
$("#openModal").addEventListener("click", openModal); $("#closeModal").addEventListener("click", closeModal); $("#cancelModal").addEventListener("click", closeModal);
$("#goalModal").addEventListener("click", (event) => { if (event.target === $("#goalModal")) closeModal(); });
$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#goalName").value.trim(); if (!name) return;
  const category = $("#goalCategory").value;
  habits.push({ id: Date.now(), name, meta: `Daily · ${category}`, emoji: "✦", time: "Any time", done: false });
  activity.unshift({ id: Date.now() + 1, name, category, date: "Just now", status: "Added" });
  persistAccount(); renderHabits(); renderActivity(); closeModal(); showToast("New goal created");
});
$("#themeToggle").addEventListener("click", toggleTheme);
if (activeAccount.theme !== "light") document.body.classList.add("dark");
renderProfile();
$("#profileButton").addEventListener("click", () => toggleProfileMenu());
$("#settingsButton").addEventListener("click", () => { toggleProfileMenu(false); openAccount(); });
$("#menuThemeButton").addEventListener("click", toggleTheme);
$("#logoutButton").addEventListener("click", logout);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".profile") && !event.target.closest("#profileMenu")) toggleProfileMenu(false);
});
$("#closeAccount").addEventListener("click", closeAccount); $("#cancelAccount").addEventListener("click", closeAccount);
$("#accountModal").addEventListener("click", (event) => { if (event.target === $("#accountModal")) closeAccount(); });
$("#accountForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (creatingWorkspace) {
    const id = `account-${Date.now()}`;
    accounts.records[id] = {
      profile: { name: $("#accountName").value.trim(), email: $("#accountEmail").value.trim(), workspace: $("#workspaceName").value.trim() },
      habits: [], activity: [], completionLog: {}, selectedMonth: new Date().toISOString().slice(0, 7), theme: "dark"
    };
    accounts.activeId = id;
    activeAccount = accounts.records[id];
    habits = [];
    activity = [];
    completionLog = {};
    selectedMonth = activeAccount.selectedMonth;
    creatingWorkspace = false;
    store.set(accountStoreKey, accounts);
    document.body.classList.add("dark");
    renderProfile(); setupMonthSelect(); renderHabits(); renderActivity(); closeAccount();
    showToast("New workspace created");
    return;
  }
  activeAccount.profile = { name: $("#accountName").value.trim(), email: $("#accountEmail").value.trim(), workspace: $("#workspaceName").value.trim() };
  activeAccount.theme = $("#settingsTheme").value;
  activeAccount.preferences = { density: $("#settingsDensity").value, startView: $("#settingsStartView").value, weekStart: $("#settingsWeekStart").value, reduceMotion: $("#settingsMotion").checked, notifications: $("#settingsNotifications").checked, reminderTime: $("#settingsReminderTime").value };
  document.body.classList.toggle("dark", activeAccount.theme === "dark");
  persistAccount(); renderProfile(); closeAccount(); showToast(`Settings saved. Daily reminder set for ${activeAccount.preferences.reminderTime}.`);
  if (activeAccount.preferences.notifications) requestNotifications().then(checkDailyReminder).then(scheduleNativeReminder);
  else cancelNativeReminder();
});
$("#clearData").addEventListener("click", () => {
  if (!window.confirm("Clear all habits, activity, and monthly history for this workspace?")) return;
  habits = []; activity = []; completionLog = {};
  persistAccount(); renderHabits(); renderActivity(); closeAccount(); showToast("Workspace data cleared");
});
$("#newAccount").addEventListener("click", createAccount);
$("#notificationButton").addEventListener("click", async () => {
  if (activeAccount.preferences?.notifications === false) { showToast("Notifications are disabled in settings"); return; }
  const enabled = await requestNotifications();
  showToast(enabled ? "Daily reminders are enabled" : "Enable notifications to receive reminders");
});
$("#settingsReminderTime").addEventListener("input", (event) => updateReminderTimeHelp(event.target.value));
$("#helpButton").addEventListener("click", () => showToast("Check off a habit to start building your streak."));
$("#manageHabits").addEventListener("click", () => showToast("Tip: use Add goal to grow your habit list."));
$("#filterButton").addEventListener("click", () => showToast("Showing activity from this week"));
document.querySelector(".mobile-menu").addEventListener("click", () => {
  const sidebar = $(".sidebar");
  const open = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", open);
  $(".mobile-menu").setAttribute("aria-expanded", String(open));
});
function selectView(view) {
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  document.body.dataset.view = view;
  const target = document.querySelector(`#${view}`);
  if (!target) return;
  target.scrollIntoView({ behavior: document.body.classList.contains("reduce-motion") ? "auto" : "smooth", block: "start" });
  $(".sidebar").classList.remove("open");
  $(".mobile-menu").setAttribute("aria-expanded", "false");
}
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => selectView(link.dataset.view)));
document.querySelectorAll(".trend-switch").forEach((button) => button.addEventListener("click", () => renderPerformanceTrend(button.dataset.trendPeriod)));
const initialView = activeAccount.preferences?.startView || "overview";
window.setTimeout(() => selectView(initialView), 0);

let authSignUp = false;
async function initializeAuth() {
  if (!supabaseConfigured || !supabase) return;
  $("#authModal").hidden = false;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await activateCloudUser(session.user);
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    if (nextSession) activateCloudUser(nextSession.user);
  });
}
async function activateCloudUser(user) {
  const { data, error } = await supabase.from("user_workspaces").select("workspace_id,payload").eq("user_id", user.id);
  if (error) { setAuthStatus(error.message); return; }
  if (data?.length) {
    const saved = data[0].payload;
    activeAccount = saved; habits = saved.habits || []; activity = saved.activity || []; completionLog = saved.completionLog || {}; selectedMonth = saved.selectedMonth || selectedMonth;
  } else {
    activeAccount = { profile: { name: user.user_metadata?.name || user.email?.split("@")[0] || "Member", email: user.email || "", workspace: "Personal workspace" }, habits: defaultHabits, activity: defaultActivity, completionLog: {}, selectedMonth, theme: "dark" };
    habits = activeAccount.habits; activity = activeAccount.activity; completionLog = activeAccount.completionLog;
    accounts.records[accounts.activeId] = activeAccount;
  }
  renderProfile(); setupMonthSelect(); renderHabits(); renderActivity(); $("#authModal").hidden = true;
}
function setAuthStatus(message) { $("#authStatus").textContent = message; }
function activateLocalAccount(email, accountId) {
  const record = accounts.records[accountId];
  accounts.activeId = accountId; activeAccount = record;
  habits = record.habits || []; activity = record.activity || [];
  completionLog = record.completionLog || {}; selectedMonth = record.selectedMonth || new Date().toISOString().slice(0, 7);
  localAuth.sessionEmail = email; store.set(localAuthKey, localAuth); store.set(accountStoreKey, accounts);
  document.body.classList.toggle("dark", activeAccount.theme !== "light");
  renderProfile(); setupMonthSelect(); renderHabits(); renderActivity(); $("#authModal").hidden = true;
  setAuthStatus(""); showToast(`Welcome back, ${activeAccount.profile.name}`);
}
$("#authMode").addEventListener("click", () => {
  authSignUp = !authSignUp; $("#authMode").textContent = authSignUp ? "Use sign in" : "Create account"; $("#authSubmit").textContent = authSignUp ? "Create account" : "Sign in"; setAuthStatus("");
});
$("#demoMode").addEventListener("click", () => { $("#authModal").hidden = true; showToast("Local demo mode enabled"); });
$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  setAuthStatus("Working…");
  const email = $("#authEmail").value.trim().toLowerCase(); const password = $("#authPassword").value;
  if (!supabaseConfigured || !supabase) {
    if (password.length < 8) { setAuthStatus("Password must be at least 8 characters."); return; }
    if (authSignUp) {
      if (localAuth.users[email]) { setAuthStatus("An account with this email already exists. Sign in instead."); return; }
      const id = `account-${Date.now()}`;
      accounts.records[id] = { profile: { name: email.split("@")[0], email, workspace: "Personal workspace" }, habits: defaultHabits.map((habit) => ({ ...habit })), activity: defaultActivity.map((item) => ({ ...item })), completionLog: {}, selectedMonth: new Date().toISOString().slice(0, 7), theme: "dark" };
      localAuth.users[email] = { password, accountId: id };
      activateLocalAccount(email, id);
    } else {
      const user = localAuth.users[email];
      if (!user || user.password !== password) { setAuthStatus("Email or password is incorrect."); return; }
      activateLocalAccount(email, user.accountId);
    }
    return;
  }
  const result = authSignUp ? await supabase.auth.signUp({ email, password, options: { data: { name: email.split("@")[0] } } }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) { setAuthStatus(result.error.message); return; }
  if (authSignUp && !result.data.session) { setAuthStatus("Check your email to confirm your account."); return; }
  if (result.data.session) await activateCloudUser(result.data.session.user);
});
initializeAuth().then(scheduleNativeReminder);
window.setInterval(checkDailyReminder, 60000);
window.addEventListener("focus", checkDailyReminder);
