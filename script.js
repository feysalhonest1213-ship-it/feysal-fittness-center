/* =========================================================
   FEYSAL FITNESS CENTER — script.js
   - window.storage with localStorage fallback
   - Public: search members by name only.
   - Staff only (PIN protected): add / delete / clear members.
   ========================================================= */

const PREFIX = "feysal:member:";
const SHARED = true;

// Change this PIN to whatever you like
const ADMIN_PIN = "2580";

const store = {
  async set(key, value) {
    try {
      if (window.storage) { await window.storage.set(key, value, SHARED); return; }
    } catch (e) { /* fall through */ }
    localStorage.setItem(key, value);
  },
  async get(key) {
    try {
      if (window.storage) {
        const r = await window.storage.get(key, SHARED);
        return r ? r.value : null;
      }
    } catch (e) { /* not found or unavailable */ }
    return localStorage.getItem(key);
  },
  async delete(key) {
    try {
      if (window.storage) { await window.storage.delete(key, SHARED); return; }
    } catch (e) { /* fall through */ }
    localStorage.removeItem(key);
  },
  async list(prefix) {
    try {
      if (window.storage) {
        const r = await window.storage.list(prefix, SHARED);
        return r ? r.keys : [];
      }
    } catch (e) { /* fall through */ }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

async function getAllMembers() {
  const keys = await store.list(PREFIX);
  const members = await Promise.all(keys.map(async (key) => {
    const raw = await store.get(key);
    if (!raw) return null;
    try { return { key, ...JSON.parse(raw) }; } catch (e) { return null; }
  }));
  return members.filter(Boolean);
}

function memberRowHtml(m, withDelete) {
  return `
    <div class="member-row" data-key="${escapeHtml(m.key)}">
      <div class="m-info">
        <b>${escapeHtml(m.name)}</b>
        <span>${escapeHtml(m.phone)} · ${escapeHtml(m.plan)}</span>
      </div>
      ${withDelete ? `<button class="del-btn" data-key="${escapeHtml(m.key)}">Delete</button>` : ""}
    </div>`;
}

/* ---------- Public: search by name only ---------- */
const searchInput = document.getElementById("searchName");
const searchResults = document.getElementById("searchResults");

if (searchInput) {
  searchInput.addEventListener("input", async () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      searchResults.innerHTML = '<p class="empty-state">Start typing your name to search.</p>';
      return;
    }
    const members = await getAllMembers();
    const matches = members.filter((m) => m.name.toLowerCase().includes(q));
    searchResults.innerHTML = matches.length
      ? matches.map((m) => memberRowHtml(m, false)).join("")
      : '<p class="empty-state">No match found. You may not be registered yet — contact us to join.</p>';
  });
}

/* ---------- Staff login (PIN gate) ---------- */
const staffLoginBtn = document.getElementById("staffLoginBtn");
const staffArea = document.getElementById("staffArea");
const staffHeading = document.getElementById("staffHeading");
let isStaff = false;

if (staffLoginBtn) {
  staffLoginBtn.addEventListener("click", () => {
    if (isStaff) {
      isStaff = false;
      staffArea.classList.add("hidden");
      staffLoginBtn.textContent = "Staff Login";
      staffHeading.textContent = "Staff Access";
      return;
    }
    const pin = prompt("Enter staff PIN to manage members:");
    if (pin === null) return;
    if (pin === ADMIN_PIN) {
      isStaff = true;
      staffArea.classList.remove("hidden");
      staffLoginBtn.textContent = "Log Out";
      staffHeading.textContent = "Staff Panel";
      renderMembers();
    } else {
      alert("Incorrect PIN.");
    }
  });
}

/* ---------- Staff: add / list / delete members ---------- */
const regForm = document.getElementById("regForm");
const formMsg = document.getElementById("formMsg");
const memberList = document.getElementById("memberList");
const memberCount = document.getElementById("memberCount");
const clearAllBtn = document.getElementById("clearAll");

async function renderMembers() {
  const members = await getAllMembers();
  if (memberCount) memberCount.textContent = `(${members.length})`;
  if (memberList) {
    memberList.innerHTML = members.length
      ? members.map((m) => memberRowHtml(m, true)).join("")
      : '<p class="empty-state">No members registered yet.</p>';

    memberList.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await store.delete(btn.dataset.key);
        renderMembers();
      });
    });
  }
}

if (regForm) {
  regForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("fName").value.trim();
    const phone = document.getElementById("fPhone").value.trim();
    const plan = document.getElementById("fPlan").value;

    if (!name || !phone) {
      formMsg.textContent = "Please fill in the name and phone number.";
      formMsg.className = "form-msg err";
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const key = PREFIX + id;
    const data = { name, phone, plan, date: new Date().toISOString() };

    try {
      await store.set(key, JSON.stringify(data));
      formMsg.textContent = "Member added successfully.";
      formMsg.className = "form-msg ok";
      regForm.reset();
      document.getElementById("fPlan").value = "Monthly";
      renderMembers();
    } catch (err) {
      formMsg.textContent = "Something went wrong. Please try again.";
      formMsg.className = "form-msg err";
    }
  });
}

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", async () => {
    const keys = await store.list(PREFIX);
    if (!keys.length) return;
    const sure = confirm("Are you sure you want to delete all registered members? This cannot be undone.");
    if (!sure) return;
    await Promise.all(keys.map((k) => store.delete(k)));
    renderMembers();
  });
}

/* ---------- Mobile nav ---------- */
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");
burger?.addEventListener("click", () => {
  navLinks.style.display = navLinks.style.display === "flex" ? "none" : "flex";
  navLinks.style.flexDirection = "column";
  navLinks.style.position = "absolute";
  navLinks.style.top = "100%";
  navLinks.style.left = "0";
  navLinks.style.right = "0";
  navLinks.style.background = "#161310";
  navLinks.style.padding = "20px 24px";
  navLinks.style.gap = "16px";
});

/* ---------- Stat counters (animate on view) ---------- */
const statNums = document.querySelectorAll(".stat-num");
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.dataset.target, 10);
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 40));
    const tick = () => {
      cur = Math.min(target, cur + step);
      el.textContent = cur;
      if (cur < target) requestAnimationFrame(tick);
    };
    tick();
    statObserver.unobserve(el);
  });
}, { threshold: 0.4 });
statNums.forEach((el) => statObserver.observe(el));

/* ---------- Hero rep counter ---------- */
const repCount = document.getElementById("repCount");
if (repCount) {
  let reps = 0;
  setInterval(() => {
    reps = reps >= 999 ? 0 : reps + 1;
    repCount.textContent = reps;
  }, 550);
}
