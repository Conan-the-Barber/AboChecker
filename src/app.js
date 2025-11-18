/* /home/abrink/Schreibtisch/Projekte/AboChecker/abo-checker/src/app.js */

// --- Speicherfunktionen -------------------------------------------------------
// --- Persistenter Speicher für Abos (localStorage) ---

const STORAGE_KEY = "abo-checker.subscriptions.v1";
const THEME_KEY = "abo-checker.theme";

function loadSubscriptions() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            // Noch nichts gespeichert → leeres Array zurückgeben
            return [];
        }

        const parsed = JSON.parse(raw);

        // Sicherheitsnetz
        if (!Array.isArray(parsed)) {
            console.warn("Unerwartetes Format im Storage, setze leere Liste.");
            return [];
        }

        return parsed;
    } catch (err) {
        console.error("Fehler beim Laden der Abos aus localStorage:", err);
        return [];
    }
}

function saveSubscriptions(subscriptions) {
    try {
        const serialized = JSON.stringify(subscriptions);
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch (err) {
        console.error("Fehler beim Speichern der Abos in localStorage:", err);
    }
}

// --- Theme-Funktionen --------------------------------------------------------

function getStoredTheme() {
    try {
        const value = localStorage.getItem(THEME_KEY);
        if (value === "light" || value === "dark") {
            return value;
        }
        return null;
    } catch (err) {
        console.error("Fehler beim Lesen des Themes:", err);
        return null;
    }
}

function updateThemeMenuLabel(theme) {
    if (!menuItemTheme) {
        return;
    }
    if (theme === "dark") {
        menuItemTheme.textContent = "Darkmode ausschalten";
    } else {
        menuItemTheme.textContent = "Darkmode einschalten";
    }
}

function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    updateThemeMenuLabel(t);
}

function initTheme() {
    const stored = getStoredTheme();
    if (stored) {
        applyTheme(stored);
        return;
    }

    // Wenn nichts gespeichert ist: System-Preference als Start
    const prefersDark = window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
}


// --- Daten + Utils -----------------------------------------------------------

const cycles = [
{ value: "monthly",   label: "monatlich" },
{ value: "yearly",    label: "jährlich" },
{ value: "weekly",    label: "wöchentlich" },
{ value: "quarterly", label: "quartalsweise" },
{ value: "daily",     label: "täglich" },
];

function toMonthly(amount, cycle) {
const a = Number(amount) || 0;
switch (cycle) {
    case "monthly":   return a;
    case "yearly":    return a / 12;
    case "weekly":    return (a * 52) / 12;      // ≈ 4,333 ×
    case "quarterly": return a / 3;
    case "daily":     return a * 30.4375;        // durchschnittlicher Monat
    default:          return a;
}
}

function money(n) {
return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function uuid() {
return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// --- State -------------------------------------------------------------------
// {id, name, provider, category, amount, cycle, startDate, billingDay, endDate, note, debit, active}
let subs = [];
let formOpen = false;
let formMode = "new"; // "new" | "view" | "edit"

// --- DOM Refs ----------------------------------------------------------------
const panel           = document.getElementById("panel");
const listEl          = document.getElementById("list");
const emptyEl         = document.getElementById("empty");
const totalTop        = document.getElementById("totalTop");
const totalBottom     = document.getElementById("totalBottom");
const fab             = document.getElementById("fab");

const form            = document.getElementById("form");
const formId          = document.getElementById("formId");
const nameInput       = document.getElementById("name");
const debitSelect     = document.getElementById("debit");
const amountInput     = document.getElementById("amount");
const cycleSelect     = document.getElementById("cycle");
const activeChk       = document.getElementById("active");
const submitBtn       = document.getElementById("submitBtn");
const cancelBtn       = document.getElementById("cancelBtn");
const deleteBtn       = document.getElementById("deleteBtn");
const editBtn         = document.getElementById("editBtn");
const providerInput   = document.getElementById("provider");
const categoryInput   = document.getElementById("category");
const startDateInput  = document.getElementById("startDate");
const endDateInput    = document.getElementById("endDate");
const billingDayInput = document.getElementById("billingDay");
const noteInput       = document.getElementById("note");

const menuBtn         = document.getElementById("menuBtn");
const menu            = document.getElementById("menu");
const menuOverlay     = document.getElementById("menuOverlay");
const menuItemTheme   = document.getElementById("menuItemTheme");

// --- Init --------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // zuerst aus Storage laden
    subs = loadSubscriptions();

    // dann UI initialisieren
    init();

    // und einmal vollständig rendern
    render();
});


function init() {
    // cycle options
    cycleSelect.innerHTML = cycles
        .map(c => `<option value="${c.value}">${c.label}</option>`)
        .join("");

    // Theme initialisieren
    initTheme();

    // events
    fab.addEventListener("click", () => {
        resetForm();           // macht Felder leer
        setFormMode("new");    // NEW: Speichern + Abbrechen
        openForm(true);
    });

    cancelBtn.addEventListener("click", () => {
        resetForm();
        openForm(false);
    });

    form.addEventListener("submit", onSubmit);

    editBtn.addEventListener("click", () => {
        if (!formId.value) {
            return;
        }
        setFormMode("edit");
    });

    deleteBtn.addEventListener("click", () => {
        const id = formId.value;
        if (!id) {
            return;
        }
        removeSub(id);
        openForm(false);
    });

    // Klick auf Zeile öffnet das Panel (außer Checkbox)
    listEl.addEventListener("click", (e) => {
        // Klick auf Checkbox ignorieren (wird von change-Handler behandelt)
        const chk = e.target.closest('input[type="checkbox"][data-id]');
        if (chk) {
            return;
        }

        const row = e.target.closest("li.row");
        if (!row) {
            return;
        }

        const id = row.dataset.id;
        if (!id) {
            return;
        }
        startEdit(id);
    });

    // Delegation für Aktiv-Checkboxen
    listEl.addEventListener("change", (e) => {
        const chk = e.target.closest('input[type="checkbox"][data-id]');
        if (!chk) return;
        toggleActive(chk.dataset.id, chk.checked);
    });

    // Menü öffnen
    menuBtn.addEventListener("click", () => {
        openMenu(true);
    });

    // Menü schließen durch Klick auf Overlay
    menuOverlay.addEventListener("click", () => {
        openMenu(false);
    });

    // Klicks auf Menüeinträge
    menu.addEventListener("click", (event) => {
        const btn = event.target.closest(".menu__item");
        if (!btn) {
            return;
        }

        const action = btn.dataset.menuAction;
        handleMenuAction(action);
    });
}



// --- Rendering ---------------------------------------------------------------
function render() {
    // Liste
    if (subs.length === 0) {
        emptyEl.style.display = "";
        listEl.innerHTML = "";
    } else {
        emptyEl.style.display = "none";
        listEl.innerHTML = subs
            .map((s) => {
                const cycleLabel = (cycles.find(c => c.value === s.cycle) || {}).label || s.cycle;
                const perMonth = money(toMonthly(s.amount, s.cycle));
                const debitLabel = s.debit === "manual" ? "manuell" : "automatisch";

                // Untertitel dynamisch bauen
                const subParts = [];
                if (s.provider) subParts.push(escapeHTML(s.provider));
                subParts.push(money(s.amount));
                subParts.push(cycleLabel);
                const subtitle = subParts.join(" · ");

                return `
                    <li class="row" data-id="${s.id}">
                        <div class="row__title">
                            <div class="name">${escapeHTML(s.name)}</div>
                            <div class="sub">${money(s.amount)} · ${cycleLabel}</div>
                        </div>

                        <div class="hide-sm">${escapeHTML(debitLabel || "-")}</div>
                        <div class="hide-sm">${cycleLabel}</div>
                        <div class="right strong">${perMonth}</div>

                        <div class="center">
                            <input type="checkbox" data-id="${s.id}" ${s.active ? "checked" : ""} />
                        </div>
                    </li>
                `;

            })
            .join("");
    }

    // Summen
    const total = subs
        .filter((s) => s.active)
        .reduce((acc, s) => acc + toMonthly(s.amount, s.cycle), 0);

    totalTop.textContent = money(total);
    totalBottom.textContent = money(total);

    // persist
    saveSubscriptions(subs);
}

// --- Form & Actions ----------------------------------------------------------
function onSubmit(e) {
    e.preventDefault();

    const id = formId.value || null;
    const name = (nameInput.value || "").trim();
    const provider = (providerInput.value || "").trim();
    const category = (categoryInput.value || "").trim();

    const debit = (debitSelect?.value || "auto");

    const rawAmount = (amountInput.value || "").replace(",", "."); // Kommas erlauben
    const amount = Number(rawAmount);

    const cycle = cycleSelect.value || "monthly";

    const startDate = (startDateInput.value || "").trim();
    const endDate = (endDateInput.value || "").trim();

    const billingDayRaw = (billingDayInput.value || "").trim();
    const billingDay = billingDayRaw ? Number(billingDayRaw) : null;

    const note = (noteInput.value || "").trim();

    const active = !!activeChk.checked;

    if (!name || !isFinite(amount) || amount <= 0) return;

    if (id) {
        // Update
        subs = subs.map(s =>
            s.id === id
                ? {
                    ...s,
                    name,
                    provider,
                    category,
                    debit,
                    amount,
                    cycle,
                    startDate,
                    endDate,
                    billingDay,
                    note,
                    active
                }
                : s
        );
    } else {
        // Neu
        subs = [{
            id: uuid(),
            name,
            provider,
            category,
            debit,
            amount,
            cycle,
            startDate,
            endDate,
            billingDay,
            note,
            active
        }, ...subs];
    }

    resetForm();
    openForm(false);
    render();
}


function setFormMode(mode) {
    formMode = mode;

    const isView = mode === "view";
    const isNew  = mode === "new";
    const isEdit = mode === "edit";

    panel.classList.toggle("panel--view", isView);

    // alle Eingabefelder im Formular holen
    const controls = form.querySelectorAll("input, select, textarea");

    controls.forEach((el) => {
        if (el === formId) {
            return; // ID bleibt immer bearbeitbar für JS
        }

        if (isView) {
            el.setAttribute("disabled", "disabled");
        } else {
            el.removeAttribute("disabled");
        }
    });

    // Buttons:
    // VIEW: Bearbeiten + Abbrechen
    if (isView) {
        editBtn.style.display    = "";
        submitBtn.style.display  = "none";
        deleteBtn.style.display  = "none"; // Löschen erst im Edit-Mode
        cancelBtn.style.display  = "";
    }

    // NEW: Speichern + Abbrechen
    if (isNew) {
        editBtn.style.display    = "none";
        submitBtn.style.display  = "";
        submitBtn.textContent    = "Speichern";
        deleteBtn.style.display  = "none";
        cancelBtn.style.display  = "";
    }

    // EDIT: Speichern + Löschen + Abbrechen
    if (isEdit) {
        editBtn.style.display    = "none";
        submitBtn.style.display  = "";
        submitBtn.textContent    = "Speichern";
        deleteBtn.style.display  = "";
        cancelBtn.style.display  = "";
    }
}

// edit-Modus: Formular mit Werten füllen/bearbeiten
function startEdit(id) {
    const s = subs.find((x) => x.id === id);
    if (!s) {
        return;
    }

    formId.value        = s.id;
    nameInput.value     = s.name || "";
    providerInput.value = s.provider || "";
    categoryInput.value = s.category || "";

    debitSelect.value   = s.debit || "auto";
    amountInput.value   = String(s.amount ?? "");
    cycleSelect.value   = s.cycle || "monthly";

    startDateInput.value  = s.startDate || "";
    endDateInput.value    = s.endDate || "";
    billingDayInput.value = (s.billingDay != null && !Number.isNaN(s.billingDay))
        ? String(s.billingDay)
        : "";

    noteInput.value = s.note || "";

    activeChk.checked = !!s.active;

    setFormMode("view");
    openForm(true);
}

function resetForm() {
    form.reset();
    formId.value = "";

    // Defaults für Selects / Checkbox
    debitSelect.value = "auto";
    cycleSelect.value = "monthly";
    activeChk.checked = true;

    // neue Felder explizit leeren
    providerInput.value   = "";
    categoryInput.value   = "";
    startDateInput.value  = "";
    endDateInput.value    = "";
    billingDayInput.value = "";
    noteInput.value       = "";

    setFormMode("new");
}

function removeSub(id) {
    const confirmed = window.confirm(
        "Dieses Abo löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    );

    if (!confirmed) {
        return;
    }

    subs = subs.filter((s) => s.id !== id);

    // falls gerade editiert wird -> Formular zurücksetzen
    if (formId.value === id) {
        resetForm();
    }

    render();
}

function clearAllSubscriptions() {
    const confirmed = window.confirm(
        "Wirklich alle Abos entfernen? Diese Aktion kann nicht rückgängig gemacht werden."
    );

    if (!confirmed) {
        return;
    }

    subs = [];
    render();
}

function toggleActive(id, value) {
    subs = subs.map(s => (s.id === id ? { ...s, active: !!value } : s));
    render();
}

function openForm(open) {
    formOpen = !!open;
    panel.classList.toggle("panel--open", formOpen);
    if (formOpen) setTimeout(() => nameInput.focus(), 50);
}

function openMenu(open) {
    const isOpen = !!open;
    menu.classList.toggle("menu--open", isOpen);
    menuOverlay.classList.toggle("menu-overlay--visible", isOpen);
}

function handleMenuAction(action) {
    switch (action) {
        case "clear-all":
            clearAllSubscriptions();
            break;
        case "toggle-dark":
            toggleTheme();
            break;
        // case "language":
        //     openLanguageDialog();
        //     break;

        default:
            break;
    }

    // Nach Aktion Menü schließen
    openMenu(false);
}


// --- Helpers -----------------------------------------------------------------
function escapeHTML(str) {
return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
