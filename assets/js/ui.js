/* Signal System · UI primitives */
window.UI = (function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const money2 = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyC = (n, cur) => {
    if ((cur || "USD") === "IDR") return "Rp" + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });
    return "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  const fmtDate = (d) => { if (!d) return "—"; const x = new Date(d + (d.length === 10 ? "T12:00:00" : "")); return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: x.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); };
  const fmtDT = (d) => { if (!d) return "—"; return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
  const rel = (d) => { if (!d) return ""; const days = Math.round((new Date(d) - new Date()) / 86400000); if (days === 0) return "today"; if (days === 1) return "tomorrow"; if (days === -1) return "yesterday"; if (days > 1) return "in " + days + "d"; return Math.abs(days) + "d ago"; };
  const initials = (n) => String(n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const avatarColor = (n) => { const t = window.SignalConfig.team.find((x) => x.name === n); return t ? t.color : "#52525B"; };

  const STATUS_COLORS = {
    "Healthy": "#16A34A", "At Risk": "#D97706", "Delayed": "#DC2626",
    "Active": "#FF6600", "Planning": "#71717A", "On Hold": "#D97706", "Completed": "#16A34A", "Archived": "#A1A1AA",
    "To Do": "#71717A", "In Progress": "#2563EB", "Review": "#7C3AED", "Blocked": "#DC2626", "Done": "#16A34A",
    "Low": "#71717A", "Medium": "#2563EB", "High": "#EA580C", "Urgent": "#DC2626",
    "New Lead": "#71717A", "Qualified": "#2563EB", "Contacted": "#0EA5A0", "Discovery": "#7C3AED", "Proposal": "#EA580C", "Negotiation": "#D97706", "Won": "#16A34A", "Lost": "#A1A1AA",
    "Draft": "#71717A", "Sent": "#2563EB", "Viewed": "#0EA5A0", "Partially Paid": "#D97706", "Paid": "#16A34A", "Overdue": "#DC2626", "Cancelled": "#A1A1AA",
    "Confirmed": "#2563EB", "Invoiced": "#7C3AED",
    "Billed": "#7C3AED", "Unpaid": "#EA580C",
    "Idea": "#71717A", "Brief": "#2563EB", "Production": "#EA580C", "Internal Review": "#7C3AED", "Client Review": "#D97706", "Approved": "#0EA5A0", "Scheduled": "#2563EB", "Published": "#16A34A",
    "Planned": "#71717A", "Paused": "#D97706",
    "Lead": "#71717A", "Prospect": "#2563EB", "Active Client": "#16A34A", "Past Client": "#A1A1AA", "Inactive": "#D4D4D8",
  };
  const pill = (s) => {
    const c = STATUS_COLORS[s] || "#52525B";
    return `<span class="chip" style="border-color:${c}22;background:${c}0D;color:${c}"><span class="dot" style="background:${c}"></span>${esc(s)}</span>`;
  };
  const avatar = (name, sz) => `<span class="avatar" title="${esc(name || "")}" style="background:${avatarColor(name)};${sz ? `width:${sz}px;height:${sz}px;` : ""}">${esc(initials(name))}</span>`;
  const svcTag = (key) => { const s = window.SignalConfig.serviceKeys.find((x) => x.key === key); return `<span class="chip font-num">${esc(s ? s.short : (key || "").slice(0, 3).toUpperCase())}</span>`; };

  // ---- toast ----
  function toast(msg, sub) {
    const root = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast-in card flex items-start gap-3 px-4 py-3 shadow-lg";
    el.style.cssText = "min-width:260px;max-width:340px;box-shadow:0 12px 32px -12px rgba(0,0,0,.18)";
    el.innerHTML = `<span class="dot mt-1.5" style="background:#FF6600"></span><div><div class="text-[.82rem] font-semibold">${esc(msg)}</div>${sub ? `<div class="text-[.75rem] text-zinc-500">${esc(sub)}</div>` : ""}</div>`;
    root.appendChild(el);
    setTimeout(() => { el.style.transition = "all .3s"; el.style.opacity = "0"; el.style.transform = "translateY(6px)"; setTimeout(() => el.remove(), 300); }, 2600);
  }

  // ---- modal ----
  function openModal({ title, sub, body, actions, wide }) {
    closeModal();
    const wrap = document.createElement("div");
    wrap.id = "modal";
    wrap.className = "modal-bg fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6";
    wrap.innerHTML = `
      <div class="absolute inset-0 bg-black/35" data-close></div>
      <div class="modal-panel relative bg-white w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} rounded-t-2xl sm:rounded-2xl border border-[#E8E8E6] max-h-[92vh] flex flex-col">
        <div class="px-5 sm:px-6 pt-5 pb-4 border-b border-[#F1F1EF]">
          <div class="flex items-start justify-between gap-4">
            <div><h3 class="text-[1rem] font-bold tracking-tight">${esc(title)}</h3>${sub ? `<p class="text-[.78rem] text-zinc-500 mt-0.5">${esc(sub)}</p>` : ""}</div>
            <button data-close class="btn-g !px-2.5 !py-1.5">✕</button>
          </div>
        </div>
        <div class="px-5 sm:px-6 py-5 overflow-y-auto" id="modal-body"></div>
        <div class="px-5 sm:px-6 py-4 border-t border-[#F1F1EF] flex items-center justify-end gap-2 bg-[#FAFAF9] rounded-b-2xl" id="modal-actions"></div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("modal-body").innerHTML = body || "";
    const act = document.getElementById("modal-actions");
    (actions || [{ label: "Cancel", ghost: true }, { label: "Save Changes", primary: true, id: "m-save" }]).forEach((a) => {
      const b = document.createElement("button");
      b.textContent = a.label;
      b.id = a.id || "";
      b.className = a.primary ? "btn-a" : a.dark ? "btn-p" : "btn-g";
      b.onclick = a.onClick || (() => closeModal());
      act.appendChild(b);
    });
    wrap.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModal));
    wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    return wrap;
  }
  function closeModal() { document.getElementById("modal")?.remove(); }

  function confirmDestructive(title, body, onYes) {
    openModal({
      title, body: `<p class="text-[.84rem] text-zinc-600">${esc(body)}</p>`,
      actions: [
        { label: "Cancel", ghost: true, onClick: closeModal },
        { label: "Delete", primary: true, id: "m-del", onClick: () => { closeModal(); onYes(); } },
      ],
    });
  }

  // ---- drawer ----
  function openDrawer(title, bodyHTML) {
    closeDrawer();
    const wrap = document.createElement("div");
    wrap.id = "drawer";
    wrap.className = "modal-bg fixed inset-0 z-[75]";
    wrap.innerHTML = `
      <div class="absolute inset-0 bg-black/30" data-close></div>
      <aside class="drawer absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white border-l border-[#E8E8E6] flex flex-col">
        <div class="px-6 py-5 border-b border-[#F1F1EF] flex items-start justify-between gap-3">
          <h3 class="text-[1rem] font-bold tracking-tight">${esc(title)}</h3>
          <button data-close class="btn-g !px-2.5 !py-1.5">✕</button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5">${bodyHTML}</div>
      </aside>`;
    document.body.appendChild(wrap);
    wrap.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeDrawer));
    return wrap;
  }
  function closeDrawer() { document.getElementById("drawer")?.remove(); }

  // ---- charts (dependency-free SVG) ----
  function spark(points, color, w, h) {
    w = w || 120; h = h || 32;
    const max = Math.max(...points, 1), min = Math.min(...points, 0);
    const px = points.map((v, i) => `${(i / (points.length - 1)) * w},${h - 3 - ((v - min) / (max - min || 1)) * (h - 8)}`).join(" ");
    return `<svg width="${w}" height="${h}" class="overflow-visible"><polyline points="${px}" fill="none" stroke="${color || "#FF6600"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function bars(values, labels, color) {
    const max = Math.max(...values, 1);
    return `<div class="flex items-end gap-1.5 h-28">${values.map((v, i) => `
      <div class="flex-1 flex flex-col items-center gap-1" title="${esc(labels[i])}: ${money(v)}">
        <div class="w-full rounded-md transition-all" style="height:${Math.max(6, (v / max) * 96)}px;background:${i === values.length - 1 ? "#FF6600" : "#E4E4E2"}"></div>
        <span class="text-[.6rem] text-zinc-400 font-medium">${esc(labels[i])}</span>
      </div>`).join("")}</div>`;
  }
  function donut(parts) {
    // parts: [{value,color,label}]
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    let acc = 0; const R = 34, C = 2 * Math.PI * R;
    const segs = parts.map((p) => {
      const frac = p.value / total, off = acc; acc += frac;
      return `<circle cx="45" cy="45" r="${R}" fill="none" stroke="${p.color}" stroke-width="11"
        stroke-dasharray="${(frac * C).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off * C).toFixed(1)}"
        transform="rotate(-90 45 45)" stroke-linecap="butt"/>`;
    }).join("");
    return `<div class="flex items-center gap-4"><svg width="90" height="90" viewBox="0 0 90 90">${segs}
      <text x="45" y="49" text-anchor="middle" font-size="13" font-weight="800" fill="#111113">${Math.round((parts[0]?.value / total) * 100) || 0}%</text></svg>
      <div class="space-y-1.5">${parts.map((p) => `<div class="flex items-center gap-2 text-[.75rem]"><span class="dot" style="background:${p.color}"></span><span class="text-zinc-500">${esc(p.label)}</span><span class="font-bold font-num ml-auto">${money(p.value)}</span></div>`).join("")}</div></div>`;
  }

  // ---- states ----
  const empty = (title, sub, cta) => `
    <div class="text-center py-12 px-6">
      <div class="mx-auto w-11 h-11 rounded-xl bg-[#F4F4F2] flex items-center justify-center mb-3">
        <span class="dot" style="background:#FF6600;width:10px;height:10px"></span>
      </div>
      <p class="font-bold text-[.9rem]">${esc(title)}</p>
      <p class="text-[.78rem] text-zinc-500 mt-1 mb-4">${esc(sub || "")}</p>
      ${cta || ""}
    </div>`;
  const skeletonRows = (n) => Array.from({ length: n || 4 }).map(() => `<div class="skel h-11 mb-2"></div>`).join("");

  // ---- filter chips ----
  function chips(active, onRemove) {
    if (!active.length) return "";
    return `<div class="flex flex-wrap gap-1.5 mb-3">${active.map((f) => `
      <button class="chip hover:border-zinc-900" data-chip="${esc(f.key)}:${esc(f.value)}">${esc(f.label)}: ${esc(f.value)} <span class="text-zinc-400">✕</span></button>`).join("")}</div>`;
  }

  return { esc, money, money2, moneyC, fmtDate, fmtDT, rel, initials, avatar, avatarColor, pill, svcTag, toast, openModal, closeModal, confirmDestructive, openDrawer, closeDrawer, spark, bars, donut, empty, skeletonRows, chips, STATUS_COLORS };
})();
