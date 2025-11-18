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
let subs = loadSubscriptions();    // {id, name, amount:Number, cycle:String, active:Boolean}
let formOpen = false;             // Panel-Status

// --- DOM Refs ----------------------------------------------------------------
const panel      = document.getElementById("panel");
const listEl     = document.getElementById("list");
const emptyEl    = document.getElementById("empty");
const totalTop   = document.getElementById("totalTop");
const totalBottom= document.getElementById("totalBottom");
const fab        = document.getElementById("fab");

const form       = document.getElementById("form");
const formId     = document.getElementById("formId");
const nameInput  = document.getElementById("name");
const debitSelect= document.getElementById("debit");
const amountInput= document.getElementById("amount");
const cycleSelect= document.getElementById("cycle");
const activeChk  = document.getElementById("active");
const submitBtn  = document.getElementById("submitBtn");
const cancelBtn  = document.getElementById("cancelBtn");

const menuBtn       = document.getElementById("menuBtn");
const menu          = document.getElementById("menu");
const menuOverlay   = document.getElementById("menuOverlay");
const menuItemTheme = document.getElementById("menuItemTheme");

// --- Init --------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // zuerst aus Storage laden
    subs = loadSubscriptions();

    // dann UI initialisieren + einmal rendern
    init();
});

function init() {
    render();
    // cycle options
    cycleSelect.innerHTML = cycles
        .map(c => `<option value="${c.value}">${c.label}</option>`)
        .join("");

    // Theme initialisieren
    initTheme();

    // aus Speicher laden (zur sicherheit nochmal)
    subs = loadSubscriptions();

    // events
    fab.addEventListener("click", () => {
        resetForm();
        openForm(true);
    });

    cancelBtn.addEventListener("click", () => {
        resetForm();
        openForm(false);
    });

    form.addEventListener("submit", onSubmit);

    // Delegation für List-Buttons
    listEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const id = btn.dataset.id;

        switch (btn.dataset.action) {
            case "edit":
                startEdit(id);
                break;
            case "del":
                removeSub(id);
                break;
        }
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

                return `
                    <li class="row">
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

                        <div class="right row__actions">
                            <button class="btn" data-action="edit" data-id="${s.id}">Bearb.</button>
                            <button class="btn btn--danger" data-action="del" data-id="${s.id}">Löschen</button>
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
    const debit = (debitSelect?.value || "auto");
    const rawAmount = (amountInput.value || "").replace(",", "."); // Kommas erlauben
    const amount = Number(rawAmount);

    const cycle = cycleSelect.value || "monthly";
    const active = !!activeChk.checked;

    if (!name || !isFinite(amount) || amount <= 0) return;

    if (id) {
        subs = subs.map(s => s.id === id ? { ...s, name, debit, amount, cycle, active } : s);
    } else {
        subs = [{ id: uuid(), name, debit, amount, cycle, active }, ...subs];
    }

    resetForm();
    openForm(false);
    render();
}

function startEdit(id) {
    const s = subs.find(x => x.id === id);
    if (!s) return;
    formId.value = s.id;
    nameInput.value = s.name;
    debitSelect.value = s.debit || "auto";
    amountInput.value = String(s.amount);
    cycleSelect.value = s.cycle;
    activeChk.checked = !!s.active;
    submitBtn.textContent = "Speichern";
    openForm(true);
}

function removeSub(id) {
    subs = subs.filter(s => s.id !== id);
    const confirmed = window.confirm(
        "Dieses Abo löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    );
    // falls gerade editiert wird -> Formular zurücksetzen
    if (formId.value === id)
    resetForm();
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
    saveSubscriptions(subs);
    render();
}

function toggleActive(id, value) {
    subs = subs.map(s => (s.id === id ? { ...s, active: !!value } : s));
    render();
}

function resetForm() {
    form.reset();
    formId.value = "";
    debitSelect.value = "auto";
    cycleSelect.value = "monthly";
    activeChk.checked = true;
    submitBtn.textContent = "Hinzufügen";
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
    render();
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
