(function(){
  "use strict";

  /* ==========================================================
     ToDoFlow — vanilla JS app logic
     State model: array of task objects persisted to localStorage
     { id, text, completed, createdAt, order, due, priority }
     ========================================================== */

  const STORAGE_KEY = "todoflow.tasks";
  const THEME_KEY = "todoflow.theme";
  const PROFILE_KEY = "todoflow.profile";
  const MAX_TASK_EXP = 50;
  const EXP_PER_LEVEL = 100;
  const AVATAR_EMOJIS = ["🙂","😎","🚀","🔥","🌱","🎯","🧠","⚡","🐱","🦊","🌸","💡"];

  const els = {
    composer: document.getElementById("composer"),
    input: document.getElementById("task-input"),

    // custom due-date picker
    dateField: document.getElementById("date-field"),
    dateTrigger: document.getElementById("date-trigger"),
    dateTriggerLabel: document.getElementById("date-trigger-label"),
    dateMenu: document.getElementById("date-menu"),
    calLabel: document.getElementById("cal-label"),
    calGrid: document.getElementById("cal-grid"),
    calPrev: document.getElementById("cal-prev"),
    calNext: document.getElementById("cal-next"),
    calClear: document.getElementById("cal-clear"),
    calToday: document.getElementById("cal-today"),

    // custom EXP stepper
    expMinus: document.getElementById("exp-minus"),
    expPlus: document.getElementById("exp-plus"),
    expValueEl: document.getElementById("exp-value"),
    repeatToggle: document.getElementById("repeat-toggle"),

    // custom priority dropdown
    priorityField: document.getElementById("priority-field"),
    priorityTrigger: document.getElementById("priority-trigger"),
    priorityTriggerLabel: document.getElementById("priority-trigger-label"),
    priorityMenu: document.getElementById("priority-menu"),
    priorityOptions: document.querySelectorAll(".priority-option"),
    list: document.getElementById("task-list"),
    empty: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptyCopy: document.getElementById("empty-copy"),
    search: document.getElementById("search-input"),
    filters: document.querySelectorAll(".filter-btn"),
    remaining: document.getElementById("remaining-count"),
    clearBtn: document.getElementById("clear-completed-btn"),
    toasts: document.getElementById("toast-container"),
    themeDarkBtn: document.getElementById("theme-dark-btn"),
    themeLightBtn: document.getElementById("theme-light-btn"),

    // profile / account
    profileChip: document.getElementById("profile-chip"),
    profileChipAvatar: document.getElementById("profile-chip-avatar"),
    profileChipName: document.getElementById("profile-chip-name"),
    profileChipLevel: document.getElementById("profile-chip-level"),

    welcomeOverlay: document.getElementById("welcome-overlay"),
    welcomeName: document.getElementById("welcome-name"),
    welcomeAvatarPicker: document.getElementById("welcome-avatar-picker"),
    welcomePhotoInput: document.getElementById("welcome-photo-input"),
    welcomeCreateBtn: document.getElementById("welcome-create-btn"),

    profileOverlay: document.getElementById("profile-overlay"),
    profilePreviewAvatar: document.getElementById("profile-preview-avatar"),
    profilePreviewLevel: document.getElementById("profile-preview-level"),
    profileXpFill: document.getElementById("profile-xp-fill"),
    profileXpCaption: document.getElementById("profile-xp-caption"),
    profileNameInput: document.getElementById("profile-name-input"),
    profileAvatarPicker: document.getElementById("profile-avatar-picker"),
    profilePhotoInput: document.getElementById("profile-photo-input"),
    profileCloseBtn: document.getElementById("profile-close-btn"),
    profileSaveBtn: document.getElementById("profile-save-btn"),
    profileLogoutBtn: document.getElementById("profile-logout-btn"),
  };

  let tasks = loadTasks();
  let filter = "all";
  let query = "";
  let dragId = null;
  let selectedPriority = "";

  /* ---------------- custom priority dropdown ---------------- */
  const PRIORITY_LABELS = { "": "No priority", low: "Low", medium: "Medium", high: "High" };

  function setPriority(value){
    selectedPriority = value;
    els.priorityTriggerLabel.textContent = PRIORITY_LABELS[value] || "No priority";
    els.priorityOptions.forEach(opt => {
      const isActive = opt.getAttribute("data-value") === value;
      opt.classList.toggle("active", isActive);
      opt.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }
  function openPriorityMenu(){
    els.priorityField.classList.add("open");
    els.priorityTrigger.setAttribute("aria-expanded", "true");
  }
  function closePriorityMenu(){
    els.priorityField.classList.remove("open");
    els.priorityTrigger.setAttribute("aria-expanded", "false");
  }
  els.priorityTrigger.addEventListener("click", () => {
    if(els.priorityField.classList.contains("open")) closePriorityMenu();
    else openPriorityMenu();
  });
  els.priorityMenu.addEventListener("click", e => {
    const opt = e.target.closest(".priority-option");
    if(!opt) return;
    setPriority(opt.getAttribute("data-value"));
    closePriorityMenu();
  });
  document.addEventListener("click", e => {
    if(!els.priorityField.contains(e.target)) closePriorityMenu();
  });
  document.addEventListener("keydown", e => {
    if(e.key === "Escape") closePriorityMenu();
  });

  /* ---------------- custom due-date picker (mini calendar) ---------------- */
  const WEEKDAY_START = 0; // Sunday
  let selectedDueISO = "";      // "" = no due date, else "yyyy-mm-dd"
  const todayDate = new Date();
  let calViewYear = todayDate.getFullYear();
  let calViewMonth = todayDate.getMonth();

  function pad2(n){ return String(n).padStart(2, "0"); }
  function toISO(y, m, d){ return y + "-" + pad2(m + 1) + "-" + pad2(d); }
  function isoIsToday(iso){
    return iso === toISO(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  }

  function renderCalendar(){
    els.calLabel.textContent = new Date(calViewYear, calViewMonth, 1)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const firstWeekday = new Date(calViewYear, calViewMonth, 1).getDay();
    const totalDays = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const leadingBlanks = (firstWeekday - WEEKDAY_START + 7) % 7;

    els.calGrid.innerHTML = "";
    for(let i = 0; i < leadingBlanks; i++){
      const blank = document.createElement("span");
      blank.className = "cal-day empty";
      els.calGrid.appendChild(blank);
    }
    for(let day = 1; day <= totalDays; day++){
      const iso = toISO(calViewYear, calViewMonth, day);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day" + (isoIsToday(iso) ? " today" : "") + (iso === selectedDueISO ? " selected" : "");
      btn.textContent = day;
      btn.setAttribute("data-date", iso);
      els.calGrid.appendChild(btn);
    }
  }

  function setDueDate(iso){
    selectedDueISO = iso;
    els.dateTriggerLabel.textContent = iso ? formatDue(iso) : "Pick a date";
    els.dateTrigger.classList.toggle("has-value", !!iso);
  }

  function openDateMenu(){
    if(selectedDueISO){
      const [y, m] = selectedDueISO.split("-").map(Number);
      calViewYear = y; calViewMonth = m - 1;
    }
    renderCalendar();
    els.dateField.classList.add("open");
    els.dateTrigger.setAttribute("aria-expanded", "true");
  }
  function closeDateMenu(){
    els.dateField.classList.remove("open");
    els.dateTrigger.setAttribute("aria-expanded", "false");
  }

  els.dateTrigger.addEventListener("click", () => {
    if(els.dateField.classList.contains("open")) closeDateMenu();
    else openDateMenu();
  });
  els.calGrid.addEventListener("click", e => {
    const btn = e.target.closest(".cal-day:not(.empty)");
    if(!btn) return;
    setDueDate(btn.getAttribute("data-date"));
    closeDateMenu();
  });
  els.calPrev.addEventListener("click", () => {
    calViewMonth--;
    if(calViewMonth < 0){ calViewMonth = 11; calViewYear--; }
    renderCalendar();
  });
  els.calNext.addEventListener("click", () => {
    calViewMonth++;
    if(calViewMonth > 11){ calViewMonth = 0; calViewYear++; }
    renderCalendar();
  });
  els.calClear.addEventListener("click", () => {
    setDueDate("");
    closeDateMenu();
  });
  els.calToday.addEventListener("click", () => {
    setDueDate(toISO(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
    closeDateMenu();
  });
  document.addEventListener("click", e => {
    if(!els.dateField.contains(e.target)) closeDateMenu();
  });
  document.addEventListener("keydown", e => {
    if(e.key === "Escape") closeDateMenu();
  });

  /* ---------------- custom EXP stepper ---------------- */
  const EXP_STEP = 5;
  let expAmount = 0;

  function setExpAmount(value){
    expAmount = Math.min(MAX_TASK_EXP, Math.max(0, value));
    els.expValueEl.textContent = expAmount + " XP";
    els.expMinus.disabled = expAmount <= 0;
    els.expPlus.disabled = expAmount >= MAX_TASK_EXP;
  }
  els.expMinus.addEventListener("click", () => setExpAmount(expAmount - EXP_STEP));
  els.expPlus.addEventListener("click", () => setExpAmount(expAmount + EXP_STEP));

  /* ---------------- repeat-daily toggle ---------------- */
  let repeatDaily = false;
  function setRepeatDaily(value){
    repeatDaily = !!value;
    els.repeatToggle.classList.toggle("active", repeatDaily);
    els.repeatToggle.setAttribute("aria-pressed", String(repeatDaily));
  }
  els.repeatToggle.addEventListener("click", () => setRepeatDaily(!repeatDaily));

  /* ---------------- persistence ---------------- */
  function loadTasks(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){
      console.warn("ToDoFlow: could not read saved tasks", e);
      return [];
    }
  }
  function saveTasks(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  /* ---------------- theme ---------------- */
  function applyTheme(theme){
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    els.themeDarkBtn.classList.toggle("active", theme === "dark");
    els.themeLightBtn.classList.toggle("active", theme === "light");
  }
  (function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    // Dark by default, regardless of the OS/browser color-scheme preference.
    // Users can still switch to light via the toggle — that choice is remembered.
    applyTheme(saved || "dark");
  })();
  els.themeDarkBtn.addEventListener("click", () => applyTheme("dark"));
  els.themeLightBtn.addEventListener("click", () => applyTheme("light"));

  /* ---------------- toasts ---------------- */
  function toast(message, kind){
    const t = document.createElement("div");
    t.className = "toast" + (kind === "danger" ? " danger" : "");
    t.innerHTML = '<span class="tdot"></span>' + escapeHtml(message);
    els.toasts.appendChild(t);
    setTimeout(() => {
      t.classList.add("fade-out");
      setTimeout(() => t.remove(), 240);
    }, 2200);
  }

  /* ---------------- profile / account (local — no server, no password) ---------------- */
  function loadProfile(){
    try{
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){
      console.warn("ToDoFlow: could not read saved profile", e);
      return null;
    }
  }
  function saveProfile(){
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
  function levelForExp(totalExp){
    return Math.floor(Math.max(0, totalExp) / EXP_PER_LEVEL) + 1;
  }
  function avatarInnerHtml(p){
    if(p.avatarType === "image" && p.avatarValue){
      return '<img src="' + p.avatarValue + '" alt="">';
    }
    return escapeHtml(p.avatarValue || "🙂");
  }

  let profile = loadProfile();

  function buildAvatarPicker(container, currentEmoji){
    container.innerHTML = "";
    AVATAR_EMOJIS.forEach(emoji => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "avatar-option" + (emoji === currentEmoji ? " selected" : "");
      btn.textContent = emoji;
      btn.setAttribute("data-emoji", emoji);
      container.appendChild(btn);
    });
    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "avatar-upload-btn";
    uploadBtn.title = "Upload a photo";
    uploadBtn.id = container.id + "-upload";
    uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16"/><path d="M14 14l1.5-1.5a2 2 0 0 1 2.8 0L20 14"/><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/></svg>';
    container.appendChild(uploadBtn);
  }

  function renderProfileChip(){
    if(!profile){
      els.profileChip.style.display = "none";
      return;
    }
    els.profileChip.style.display = "";
    els.profileChipAvatar.innerHTML = avatarInnerHtml(profile);
    els.profileChipName.textContent = profile.name || "Guest";
    const lvl = levelForExp(profile.totalExp);
    els.profileChipLevel.textContent = "Lv " + lvl + " · " + Math.max(0, profile.totalExp) + " XP";
  }

  function renderProfileModal(){
    if(!profile) return;
    els.profilePreviewAvatar.innerHTML = avatarInnerHtml(profile);
    const lvl = levelForExp(profile.totalExp);
    const intoLevel = Math.max(0, profile.totalExp) % EXP_PER_LEVEL;
    els.profilePreviewLevel.textContent = "Level " + lvl;
    els.profileXpFill.style.width = intoLevel + "%";
    els.profileXpCaption.textContent = intoLevel + " / " + EXP_PER_LEVEL + " XP to Level " + (lvl + 1);
    els.profileNameInput.value = profile.name || "";
    buildAvatarPicker(els.profileAvatarPicker, profile.avatarType === "emoji" ? profile.avatarValue : null);
  }

  function openModal(overlay){ overlay.classList.add("show"); }
  function closeModal(overlay){ overlay.classList.remove("show"); }

  // ---- welcome / create-account modal ----
  let welcomeSelectedEmoji = AVATAR_EMOJIS[0];
  let welcomeUploadedPhoto = null;

  function showWelcomeIfNeeded(){
    if(profile){
      renderProfileChip();
      return;
    }
    buildAvatarPicker(els.welcomeAvatarPicker, welcomeSelectedEmoji);
    openModal(els.welcomeOverlay);
  }

  els.welcomeAvatarPicker.addEventListener("click", e => {
    const opt = e.target.closest(".avatar-option");
    if(opt){
      welcomeSelectedEmoji = opt.getAttribute("data-emoji");
      welcomeUploadedPhoto = null;
      buildAvatarPicker(els.welcomeAvatarPicker, welcomeSelectedEmoji);
      return;
    }
    if(e.target.closest(".avatar-upload-btn")){
      els.welcomePhotoInput.click();
    }
  });

  els.welcomePhotoInput.addEventListener("change", () => {
    const file = els.welcomePhotoInput.files && els.welcomePhotoInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      welcomeUploadedPhoto = reader.result;
      toast("Photo added");
    };
    reader.readAsDataURL(file);
  });

  els.welcomeCreateBtn.addEventListener("click", () => {
    const name = els.welcomeName.value.trim();
    if(!name){
      toast("Enter a name to create your account", "danger");
      els.welcomeName.focus();
      return;
    }
    profile = {
      name: name,
      avatarType: welcomeUploadedPhoto ? "image" : "emoji",
      avatarValue: welcomeUploadedPhoto || welcomeSelectedEmoji,
      totalExp: 0,
    };
    saveProfile();
    renderProfileChip();
    closeModal(els.welcomeOverlay);
    toast("Account created — welcome, " + name + "!");
  });

  els.welcomeName.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.preventDefault(); els.welcomeCreateBtn.click(); }
  });

  // ---- customize-profile modal ----
  let profileSelectedEmoji = null;
  let profilePendingPhoto = null;

  els.profileChip.addEventListener("click", () => {
    if(!profile) return;
    profilePendingPhoto = null;
    profileSelectedEmoji = profile.avatarType === "emoji" ? profile.avatarValue : null;
    renderProfileModal();
    openModal(els.profileOverlay);
  });

  els.profileAvatarPicker.addEventListener("click", e => {
    const opt = e.target.closest(".avatar-option");
    if(opt){
      profileSelectedEmoji = opt.getAttribute("data-emoji");
      profilePendingPhoto = null;
      buildAvatarPicker(els.profileAvatarPicker, profileSelectedEmoji);
      els.profilePreviewAvatar.innerHTML = escapeHtml(profileSelectedEmoji);
      return;
    }
    if(e.target.closest(".avatar-upload-btn")){
      els.profilePhotoInput.click();
    }
  });

  els.profilePhotoInput.addEventListener("change", () => {
    const file = els.profilePhotoInput.files && els.profilePhotoInput.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      profilePendingPhoto = reader.result;
      profileSelectedEmoji = null;
      els.profilePreviewAvatar.innerHTML = '<img src="' + reader.result + '" alt="">';
      toast("Photo added");
    };
    reader.readAsDataURL(file);
  });

  els.profileCloseBtn.addEventListener("click", () => closeModal(els.profileOverlay));

  els.profileSaveBtn.addEventListener("click", () => {
    const name = els.profileNameInput.value.trim();
    if(!name){
      toast("Enter a name", "danger");
      els.profileNameInput.focus();
      return;
    }
    profile.name = name;
    if(profilePendingPhoto){
      profile.avatarType = "image";
      profile.avatarValue = profilePendingPhoto;
    }else if(profileSelectedEmoji){
      profile.avatarType = "emoji";
      profile.avatarValue = profileSelectedEmoji;
    }
    saveProfile();
    renderProfileChip();
    closeModal(els.profileOverlay);
    toast("Profile updated");
  });

  // ---- log out: clears the local profile only (tasks are kept) and
  // returns to the create-account screen ----
  function logout(){
    localStorage.removeItem(PROFILE_KEY);
    profile = null;
    profilePendingPhoto = null;
    profileSelectedEmoji = null;
    closeModal(els.profileOverlay);
    renderProfileChip();
    toast("Logged out");
    showWelcomeIfNeeded();
  }
  els.profileLogoutBtn.addEventListener("click", logout);

  // Close modals on backdrop click (not while dragging inside the box).
  [els.welcomeOverlay, els.profileOverlay].forEach(overlay => {
    overlay.addEventListener("click", e => {
      if(e.target === overlay && overlay === els.profileOverlay){
        closeModal(overlay); // welcome modal is required — no dismiss by backdrop
      }
    });
  });

  /**
   * Award (or revoke) EXP for a task's completion state and keep the
   * profile's level in sync. Called from toggleComplete().
   */
  function applyTaskExp(task, completed){
    if(!profile || !task.exp) return;
    const beforeLevel = levelForExp(profile.totalExp);
    if(completed && !task.expAwarded){
      profile.totalExp = Math.max(0, profile.totalExp) + task.exp;
      task.expAwarded = true;
    }else if(!completed && task.expAwarded){
      profile.totalExp = Math.max(0, profile.totalExp - task.exp);
      task.expAwarded = false;
    }else{
      return;
    }
    saveProfile();
    renderProfileChip();
    const afterLevel = levelForExp(profile.totalExp);
    if(completed){
      toast("+" + task.exp + " EXP earned");
      if(afterLevel > beforeLevel){
        toast("Level up! You're now Level " + afterLevel + " 🎉");
        fireConfetti();
      }
    }
  }

  /* ---------------- confetti ---------------- */
  const canvas = document.getElementById("confetti-canvas");
  const ctx = canvas.getContext("2d");
  let confettiPieces = [];
  let confettiRAF = null;
  function resizeCanvas(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function fireConfetti(){
    const colors = ["#4f8cff", "#a78bfa", "#f0abfc", "#22c55e", "#f0b429"];
    confettiPieces = [];
    for(let i = 0; i < 120; i++){
      confettiPieces.push({
        x: canvas.width / 2,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -10 - 4,
        size: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        life: 0,
      });
    }
    if(!confettiRAF) animateConfetti();
  }
  function animateConfetti(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    confettiPieces.forEach(p => {
      p.vy += 0.28;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.life++;
      if(p.y < canvas.height + 20 && p.life < 260){
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - p.life / 260);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });
    if(alive){
      confettiRAF = requestAnimationFrame(animateConfetti);
    }else{
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiRAF = null;
    }
  }

  /* ---------------- helpers ---------------- */
  function escapeHtml(str){
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
  function uid(){
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function isOverdue(due, completed){
    if(!due || completed) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const d = new Date(due + "T00:00:00");
    return d < today;
  }
  function formatDue(due){
    const d = new Date(due + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function todayLocalISO(){
    const d = new Date();
    return toISO(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Repeat-daily tasks: once a task marked "repeat" has been completed,
   * it stays checked off for the rest of that day. The next time the app
   * is opened on a later date, it flips back to active (and un-awards its
   * EXP, since applyTaskExp already reverses EXP whenever completed flips
   * to false) so it can be done — and earn EXP — again.
   */
  function resetDailyTasks(){
    const today = todayLocalISO();
    let changed = false;
    tasks.forEach(t => {
      if(t.repeat && t.completed && t.completedDate && t.completedDate !== today){
        t.completed = false;
        t.completedDate = null;
        applyTaskExp(t, false);
        changed = true;
      }
    });
    if(changed) saveTasks();
    return changed;
  }

  /* ---------------- CRUD ---------------- */
  function addTask(text, due, priority, exp, repeat){
    const trimmed = text.trim();
    if(!trimmed) return;
    tasks.unshift({
      id: uid(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
      due: due || "",
      priority: priority || "",
      exp: exp || 0,
      expAwarded: false,
      repeat: !!repeat,
      completedDate: null,
    });
    saveTasks();
    render();
    toast(repeat ? "Daily task added" : "Task added");
  }

  function toggleComplete(id){
    const t = tasks.find(t => t.id === id);
    if(!t) return;
    t.completed = !t.completed;
    if(t.repeat){
      t.completedDate = t.completed ? todayLocalISO() : null;
    }
    applyTaskExp(t, t.completed);
    saveTasks();
    render();
    if(t.completed){
      toast(t.repeat ? "Done for today — resets tomorrow" : "Nice work — task completed");
      if(tasks.length && tasks.every(x => x.completed)){
        fireConfetti();
        toast("All tasks done. 🎉");
      }
    }
  }

  function deleteTask(id){
    const li = els.list.querySelector('[data-id="' + id + '"]');
    if(li){
      li.classList.add("removing");
      setTimeout(() => {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        render();
      }, 180);
    }else{
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      render();
    }
    toast("Task deleted", "danger");
  }

  function editTaskText(id, newText){
    const t = tasks.find(t => t.id === id);
    if(!t) return;
    const trimmed = newText.trim();
    if(!trimmed){
      deleteTask(id);
      return;
    }
    t.text = trimmed;
    saveTasks();
    render();
  }

  function clearCompleted(){
    const count = tasks.filter(t => t.completed).length;
    if(count === 0){
      toast("No completed tasks to clear");
      return;
    }
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
    toast(count + " completed task" + (count > 1 ? "s" : "") + " cleared");
  }

  function reorder(draggedId, targetId){
    const from = tasks.findIndex(t => t.id === draggedId);
    const to = tasks.findIndex(t => t.id === targetId);
    if(from === -1 || to === -1 || from === to) return;
    const [moved] = tasks.splice(from, 1);
    tasks.splice(to, 0, moved);
    saveTasks();
    render();
  }

  /* ---------------- rendering ---------------- */
  function getVisibleTasks(){
    return tasks.filter(t => {
      if(filter === "active" && t.completed) return false;
      if(filter === "completed" && !t.completed) return false;
      if(query && !t.text.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }

  function render(){
    const visible = getVisibleTasks();
    els.list.innerHTML = "";

    visible.forEach(t => {
      const li = document.createElement("li");
      li.className = "task" + (t.completed ? " completed" : "");
      li.setAttribute("data-id", t.id);
      li.setAttribute("draggable", "true");

      const overdue = isOverdue(t.due, t.completed);
      let metaHtml = "";
      if(t.due){
        metaHtml += '<span class="chip due' + (overdue ? " overdue" : "") + '">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> ' +
          formatDue(t.due) + '</span>';
      }
      if(t.priority){
        metaHtml += '<span class="chip priority-' + t.priority + '">' + t.priority + '</span>';
      }
      if(t.exp){
        metaHtml += '<span class="chip exp-chip">⚡ ' + t.exp + ' EXP</span>';
      }
      if(t.repeat){
        metaHtml += '<span class="chip repeat-chip">🔁 Daily</span>';
      }

      li.innerHTML =
        '<span class="drag-handle" title="Drag to reorder">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="6" r="1.6"/><circle cx="8" cy="12" r="1.6"/><circle cx="8" cy="18" r="1.6"/><circle cx="16" cy="6" r="1.6"/><circle cx="16" cy="12" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>' +
        '</span>' +
        '<span class="task-check" role="checkbox" aria-checked="' + t.completed + '" tabindex="0">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3"/></svg>' +
        '</span>' +
        '<div class="task-body">' +
          '<div class="task-text" contenteditable="false" spellcheck="false">' + escapeHtml(t.text) + '</div>' +
          (metaHtml ? '<div class="task-meta">' + metaHtml + '</div>' : '') +
        '</div>' +
        '<div class="task-actions">' +
          '<button class="edit-btn" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>' +
          '<button class="delete-btn" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>' +
        '</div>';

      els.list.appendChild(li);
    });

    // empty state
    const noneAtAll = tasks.length === 0;
    const noneVisible = visible.length === 0;
    els.empty.classList.toggle("show", noneVisible);
    if(noneAtAll){
      els.emptyTitle.textContent = "All clear";
      els.emptyCopy.textContent = "Nothing on your list yet. Add your first task above to get started.";
    }else if(noneVisible && query){
      els.emptyTitle.textContent = "No matches";
      els.emptyCopy.textContent = 'Nothing matches "' + query + '". Try a different search.';
    }else if(noneVisible){
      els.emptyTitle.textContent = "Nothing here";
      els.emptyCopy.textContent = "No tasks in this filter right now.";
    }

    const remaining = tasks.filter(t => !t.completed).length;
    els.remaining.textContent = remaining + (remaining === 1 ? " task left" : " tasks left");
  }

  /* ---------------- events ---------------- */
  els.composer.addEventListener("submit", e => {
    e.preventDefault();
    // expAmount is already clamped 0-50 by the stepper, so no validation needed here.
    addTask(els.input.value, selectedDueISO, selectedPriority, expAmount, repeatDaily);
    els.input.value = "";
    setDueDate("");
    setPriority("");
    setExpAmount(0);
    setRepeatDaily(false);
    els.input.focus();
  });

  els.list.addEventListener("click", e => {
    const li = e.target.closest(".task");
    if(!li) return;
    const id = li.getAttribute("data-id");

    if(e.target.closest(".task-check")){
      toggleComplete(id);
    }else if(e.target.closest(".delete-btn")){
      deleteTask(id);
    }else if(e.target.closest(".edit-btn")){
      startEdit(li, id);
    }
  });

  els.list.addEventListener("keydown", e => {
    const li = e.target.closest(".task");
    if(!li) return;
    const id = li.getAttribute("data-id");
    if(e.target.classList.contains("task-check") && (e.key === "Enter" || e.key === " ")){
      e.preventDefault();
      toggleComplete(id);
    }
  });

  els.list.addEventListener("dblclick", e => {
    const li = e.target.closest(".task");
    const textEl = e.target.closest(".task-text");
    if(li && textEl) startEdit(li, li.getAttribute("data-id"));
  });

  function startEdit(li, id){
    const textEl = li.querySelector(".task-text");
    textEl.setAttribute("contenteditable", "true");
    textEl.focus();
    document.execCommand && placeCaretAtEnd(textEl);

    function finish(save){
      textEl.setAttribute("contenteditable", "false");
      textEl.removeEventListener("blur", onBlur);
      textEl.removeEventListener("keydown", onKeydown);
      if(save) editTaskText(id, textEl.textContent);
      else render();
    }
    function onBlur(){ finish(true); }
    function onKeydown(ev){
      if(ev.key === "Enter"){ ev.preventDefault(); textEl.blur(); }
      if(ev.key === "Escape"){ ev.preventDefault(); finish(false); }
    }
    textEl.addEventListener("blur", onBlur);
    textEl.addEventListener("keydown", onKeydown);
  }
  function placeCaretAtEnd(el){
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // drag & drop reorder
  els.list.addEventListener("dragstart", e => {
    const li = e.target.closest(".task");
    if(!li) return;
    dragId = li.getAttribute("data-id");
    li.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  els.list.addEventListener("dragend", e => {
    const li = e.target.closest(".task");
    if(li) li.classList.remove("dragging");
    dragId = null;
  });
  els.list.addEventListener("dragover", e => {
    e.preventDefault();
    const li = e.target.closest(".task");
    if(!li || !dragId) return;
    const targetId = li.getAttribute("data-id");
    if(targetId !== dragId) reorder(dragId, targetId);
  });

  els.clearBtn.addEventListener("click", clearCompleted);

  els.search.addEventListener("input", () => {
    query = els.search.value;
    render();
  });

  els.filters.forEach(btn => {
    btn.addEventListener("click", () => {
      els.filters.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.getAttribute("data-filter");
      render();
    });
  });

  // keyboard shortcuts
  document.addEventListener("keydown", e => {
    const activeTag = document.activeElement && document.activeElement.tagName;
    const isEditable = document.activeElement && document.activeElement.isContentEditable;

    if(e.key === "/" && activeTag !== "INPUT" && activeTag !== "TEXTAREA" && !isEditable){
      e.preventDefault();
      els.search.focus();
    }else if(e.key === "Escape"){
      if(document.activeElement === els.search){
        els.search.value = "";
        query = "";
        render();
        els.search.blur();
      }
    }else if(e.key === "n" && activeTag !== "INPUT" && activeTag !== "TEXTAREA" && !isEditable){
      e.preventDefault();
      els.input.focus();
    }
  });

  /* ---------------- marquees ---------------- */
  // JS-driven continuous scroll (rather than a CSS % keyframe) so the loop
  // never visibly "restarts" or snaps — position wraps by the exact
  // measured content width, which stays correct at any screen size.
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setupMarquee(id, speed, reverse){
    const track = document.getElementById(id);
    if(!track) return;

    // Duplicate the content once so there's always a second copy ready
    // to scroll in behind the first — this is what makes the wrap seamless.
    track.innerHTML += track.innerHTML;

    if(reduceMotion) return; // leave it static

    const container = track.parentElement;
    let loopWidth = track.scrollWidth / 2;
    let pos = reverse ? loopWidth : 0;
    let paused = false;
    let lastTs = null;

    // Recalculate on resize so it stays accurate if text reflows.
    window.addEventListener("resize", () => {
      loopWidth = track.scrollWidth / 2;
    });

    if(container){
      container.addEventListener("mouseenter", () => { paused = true; });
      container.addEventListener("mouseleave", () => { paused = false; });
    }

    function frame(ts){
      if(lastTs === null) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      if(!paused && loopWidth > 0){
        pos += reverse ? -speed * dt : speed * dt;
        if(pos >= loopWidth) pos -= loopWidth;
        if(pos < 0) pos += loopWidth;
      }
      track.style.transform = "translateX(" + (-pos) + "px)";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  setupMarquee("tagline-track", 34, false);
  setupMarquee("quotes-track-1", 26, false);
  setupMarquee("quotes-track-2", 26, true);

  /* ---------------- init ---------------- */
  resetDailyTasks();
  setExpAmount(0);
  showWelcomeIfNeeded();
  render();

  // If the app is left open across midnight, re-check every minute so
  // repeat-daily tasks flip back to active without needing a reload.
  setInterval(() => {
    if(resetDailyTasks()) render();
  }, 60000);
})();
