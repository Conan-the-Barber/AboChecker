/* /home/abrink/Schreibtisch/Projekte/AboChecker/abo-checker/src/app.js */

// --- Speicherfunktionen -------------------------------------------------------
// --- Persistenter Speicher für Abos (localStorage) ---

const STORAGE_KEY   = "abo-checker.subscriptions.v1";
const THEME_KEY     = "abo-checker.theme";
const DISPLAY_KEY   = "abo-checker.displayCycle";

const displayModes = ["monthly", "yearly", "weekly", "quarterly", "daily"];

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

function getStoredDisplayCycle() {
    try {
        const value = localStorage.getItem(DISPLAY_KEY);
        if (displayModes.includes(value)) {
            return value;
        }
        return null;
    } catch (err) {
        console.error("Fehler beim Lesen der Anzeige-Einheit:", err);
        return null;
    }
}

function displayUnitLabel(cycle) {
    switch (cycle) {
        case "yearly":     return "Jahr";
        case "weekly":     return "Woche";
        case "quarterly":  return "Quartal";
        case "daily":      return "Tag";
        case "monthly":
        default:           return "Monat";
    }
}

function displayShortLabel(cycle) {
    switch (cycle) {
        case "yearly":     return "/Jahr";
        case "weekly":     return "/Woche";
        case "quarterly":  return "/Quartal";
        case "daily":      return "/Tag";
        case "monthly":
        default:           return "/Monat";
    }
}

function updateDisplayTexts() {
    const unit = displayUnitLabel(displayCycle);
    const shortUnit = displayShortLabel(displayCycle);

    if (totalLabel) {
        totalLabel.textContent = `Kosten aktiv (pro ${unit}):`;
    }
    if (stickyLabel) {
        stickyLabel.textContent = `Gesamt (aktiv, pro ${unit})`;
    }
    if (amountHeader) {
        amountHeader.textContent = `€ ${shortUnit}`;
    }
    if (displaySelect) {
        displaySelect.value = displayCycle;
    }
}

function setDisplayCycle(cycle) {
    if (!displayModes.includes(cycle)) {
        cycle = "monthly";
    }
    displayCycle = cycle;
    try {
        localStorage.setItem(DISPLAY_KEY, displayCycle);
    } catch (err) {
        console.error("Fehler beim Speichern der Anzeige-Einheit:", err);
    }
    render(); // render kümmert sich auch um Texte
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

function fromMonthly(monthAmount, targetCycle) {
    const m = Number(monthAmount) || 0;
    switch (targetCycle) {
        case "yearly":
            return m * 12;
        case "weekly":
            return (m * 12) / 52;       // inverse zu weekly → monthly
        case "quarterly":
            return m * 3;
        case "daily":
            return m / 30.4375;
        case "monthly":
        default:
            return m;
    }
}

function toDisplayUnit(amount, fromCycle, targetCycle) {
    const perMonth = toMonthly(amount, fromCycle);
    return fromMonthly(perMonth, targetCycle);
}

function money(n) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function uuid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getAllCategoriesFromSubs() {
    const set = new Set();
    subs.forEach((s) => {
        if (s.category && typeof s.category === "string") {
            set.add(s.category);
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
}

function rebuildCategoryOptions() {
    if (!categorySelect) {
        return;
    }

    const currentValue = categorySelect.value || "";
    const categories = getAllCategoriesFromSubs();

    categorySelect.innerHTML = "";

    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "Keine Kategorie";
    categorySelect.appendChild(emptyOpt);

    categories.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });

    // möglichst ursprüngliche Auswahl beibehalten
    categorySelect.value = currentValue || "";
}

function ensureCategoryOption(cat) {
    if (!categorySelect || !cat) {
        return;
    }
    const valueNorm = String(cat).toLowerCase();
    const exists = Array.from(categorySelect.options).some(
        (opt) => opt.value.toLowerCase() === valueNorm
    );
    if (!exists) {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    }
}

function addNewCategoryViaPrompt() {
    let name = window.prompt("Neue Kategorie:");
    if (!name) {
        return;
    }
    name = name.trim();
    if (!name) {
        return;
    }

    ensureCategoryOption(name);
    categorySelect.value = name;
}

function deleteSelectedCategory() {
    if (!categorySelect) {
        return;
    }

    const cat = (categorySelect.value || "").trim();
    if (!cat) {
        window.alert("Bitte zuerst eine Kategorie auswählen, die gelöscht werden soll.");
        return;
    }

    const count = subs.filter((s) => (s.category || "") === cat).length;

    const confirmed = window.confirm(
        count > 0
            ? `Kategorie "${cat}" aus ${count} Abo(s) entfernen?\n` +
            `Die Abos werden auf "Keine Kategorie" gesetzt.`
            : `Kategorie "${cat}" löschen?`
    );

    if (!confirmed) {
        return;
    }

    // Alle Abos, die diese Kategorie verwenden, auf "" setzen
    subs = subs.map((s) => {
        if ((s.category || "") === cat) {
            return {
                ...s,
                category: ""
            };
        }
        return s;
    });

    // Neu rendern (damit auch Dropdown aktualisiert wird)
    render();

    if (categorySelect) {
        categorySelect.value = "";
    }
}



// --- State -------------------------------------------------------------------
// {id, name, provider, category, amount, cycle, startDate, billingDay, endDate, note, debit, active}
let subs = [];
let formOpen = false;
let formMode = "new"; // "new" | "view" | "edit"
let displayCycle = "monthly";     // NEU: Anzeige-Einheit für Gesamt/Spalte
let searchTerm = "";              // Suchtext für die Liste

// --- DOM Refs ----------------------------------------------------------------
const panel           = document.getElementById("panel");
const listEl          = document.getElementById("list");
const emptyEl         = document.getElementById("empty");
const totalTop        = document.getElementById("totalTop");
const totalBottom     = document.getElementById("totalBottom");
const fab             = document.getElementById("fab");
const totalLabel      = document.getElementById("totalLabel");
const stickyLabel     = document.getElementById("stickyLabel");
const amountHeader    = document.getElementById("amountHeader");

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
const categorySelect  = document.getElementById("categorySelect");
const categoryAddBtn  = document.getElementById("categoryAddBtn");
const categoryDeleteBtn = document.getElementById("categoryDeleteBtn");


const startDateInput  = document.getElementById("startDate");
const endDateInput    = document.getElementById("endDate");
const billingDayInput = document.getElementById("billingDay");
const noteInput       = document.getElementById("note");

const menuBtn         = document.getElementById("menuBtn");
const menu            = document.getElementById("menu");
const menuOverlay     = document.getElementById("menuOverlay");
const menuItemTheme   = document.getElementById("menuItemTheme");
const displaySelect   = document.getElementById("displaySelect");
const searchInput     = document.getElementById("searchInput");

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
    // Anzeige-Einheit aus Storage laden
    const storedDisplay = getStoredDisplayCycle();
    if (storedDisplay) {
        displayCycle = storedDisplay;
    }
    updateDisplayTexts();

    // cycle options
    cycleSelect.innerHTML = cycles
        .map(c => `<option value="${c.value}">${c.label}</option>`)
        .join("");

        // Auswahl im Menü für Anzeige-Einheit
        if (displaySelect) {
            displaySelect.value = displayCycle;
            displaySelect.addEventListener("change", (e) => {
                setDisplayCycle(e.target.value);
                openMenu(false); // Menü nach Auswahl schließen
            });
        }

    // Theme initialisieren
    initTheme();

    // events
    fab.addEventListener("click", () => {
        resetForm();           // macht Felder leer
        setFormMode("new");    // bei NEW: Speichern + Abbrechen
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

    // Suche
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchTerm = (e.target.value || "").toLowerCase();
            render();
        });
    }
        // Klicks auf Menüeinträge
    menu.addEventListener("click", (event) => {
        const btn = event.target.closest(".menu__item");
        if (!btn) {
            return;
        }

        const action = btn.dataset.menuAction;
        handleMenuAction(action);
    });

    // Suche
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchTerm = (e.target.value || "").toLowerCase();
            render();
        });
    }

    // Kategorie hinzufügen
    if (categoryAddBtn && categorySelect) {
        categoryAddBtn.addEventListener("click", addNewCategoryViaPrompt);
    }

    // Kategorie löschen
    if (categoryDeleteBtn && categorySelect) {
        categoryDeleteBtn.addEventListener("click", deleteSelectedCategory);
    }

    // Startbefüllung Kategorie-Select aus bestehenden Abos
    rebuildCategoryOptions();
}

function handleMenuAction(action) {
    switch (action) {
        case "clear-all":
            clearAllSubscriptions();
            break;
        case "toggle-dark":
            toggleTheme();
            openMenu(false);
            break;
/*         case "toggle-display":
            cycleDisplayMode();
            break; 
            ==========================================
            DEN PUNKT NOCH ANPASSEN DASS MENÜ BEI DROPDOWNTOGGLE SCHLIEßT!!!
            ==========================================
            */
        default:
            break;
    }

    // Nach Aktion Menü schließen
    openMenu(false);
}

// --- Rendering ---------------------------------------------------------------
function render() {
    // Sichtbare Liste anhand von Suche (Filter/Sortierung kommen später dazu)
    let visibleSubs = subs;

    if (searchTerm) {
        const term = searchTerm;
        visibleSubs = subs.filter((s) => {
            const haystack = [
                s.name || "",
                s.provider || "",
                s.category || "",
                s.note || ""
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(term);
        });
    }

    // Liste + Empty-State
    if (subs.length === 0) {
        // wirklich gar keine Abos angelegt
        emptyEl.style.display = "";
        emptyEl.textContent = "Noch keine Abos hinzugefügt.";
        listEl.innerHTML = "";
    } else if (visibleSubs.length === 0) {
        // es gibt Abos, aber keins passt zur Suche
        emptyEl.style.display = "";
        emptyEl.textContent = "Keine passenden Abos gefunden.";
        listEl.innerHTML = "";
    } else {
        emptyEl.style.display = "none";
        listEl.innerHTML = visibleSubs
            .map((s) => {
                const cycleLabel = (cycles.find(c => c.value === s.cycle) || {}).label || s.cycle;
                const perDisplay = money(toDisplayUnit(s.amount, s.cycle, displayCycle));
                const debitLabel = s.debit === "manual" ? "manuell" : "automatisch";

                return `
                    <li class="row" data-id="${s.id}">
                        <div class="row__title">
                            <div class="name">${escapeHTML(s.name)}</div>
                            <div class="sub">${money(s.amount)} · ${cycleLabel}</div>
                        </div>

                        <div class="hide-sm">${escapeHTML(debitLabel || "-")}</div>
                        <div class="hide-sm">${cycleLabel}</div>
                        <div class="right strong">${perDisplay}</div>

                        <div class="center">
                            <input type="checkbox" data-id="${s.id}" ${s.active ? "checked" : ""} />
                        </div>
                    </li>
                `;
            })
            .join("");
    }

    // Summen (nur aktive) in aktueller Anzeige-Einheit – immer über ALLE, nicht nur gefilterte
    const total = subs
        .filter((s) => s.active)
        .reduce((acc, s) => acc + toDisplayUnit(s.amount, s.cycle, displayCycle), 0);

    totalTop.textContent = money(total);
    totalBottom.textContent = money(total);

    updateDisplayTexts();

    // persist
    saveSubscriptions(subs);

    // Kategorien-Liste aus den aktuellen Abos aktualisieren
    rebuildCategoryOptions();
}


// --- Form & Actions ----------------------------------------------------------
function onSubmit(e) {
    e.preventDefault();

    const id = formId.value || null;
    const name = (nameInput.value || "").trim();
    const provider = (providerInput.value || "").trim();
    const category = (categorySelect.value || "").trim();

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

    if (!name || !isFinite(amount) || amount <= 0) {
        return;
    }

    if (id) {
        // Update
        subs = subs.map((s) =>
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
        subs = [
            {
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
            },
            ...subs
        ];
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
    // Kategorie spezialfall
    if (categorySelect) {
        const category = s.category || "";
        ensureCategoryOption(category);
        categorySelect.value = category;
    }

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

    // Felder explizit leeren
    providerInput.value   = "";
    if (categorySelect) {
        categorySelect.value = "";
    }
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


// --- Helpers -----------------------------------------------------------------
function escapeHTML(str) {
return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
