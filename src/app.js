/* /home/abrink/Schreibtisch/Projekte/AboChecker/abo-checker/src/app.js */

// --- Speicherfunktionen -------------------------------------------------------
// --- Persistenter Speicher für Abos (localStorage) ---

const STORAGE_KEY   = "abo-checker.subscriptions.v1";
const THEME_KEY     = "abo-checker.theme";
const DISPLAY_KEY   = "abo-checker.displayCycle";

const REMINDER_SETTINGS_KEY = "abo-checker.reminders.v1";
// Default-Einstellungen für Erinnerungen
const defaultReminderSettings = {
    billingLeadDays: 3,   // Standard: 3 Tage vor Abbuchung erinnern
    renewalLeadDays:7,  // Standard:7 Tage vor Ablauf / Verlängerung
    timeOfDay: "09:00"    // Uhrzeit der Benachrichtigung
};

const displayModes = ["monthly", "yearly", "weekly", "quarterly", "daily"];

/**
 * Normalisiert ein Abo-Objekt aus dem Storage:
 * - Ergänzt reminderConfig / reminderState, falls sie fehlen.
 * - Dient vor allem der Abwärtskompatibilität mit alten App-Versionen.
 *   Diese Funktion kann dauerhaft im Code bleiben.
 */
function normalizeSub(rawSub) {
    // defensiv kopieren, damit wir das Original nicht mutieren
    const sub = { ...rawSub };

    // --- reminderConfig ------------------------------------------------------
    if (!sub.reminderConfig || typeof sub.reminderConfig !== "object") {
        sub.reminderConfig = {
            mode: "default",          // "default" | "custom" | "off"
            billingLeadDays: null,    // null = globaler Standard
            renewalLeadDays: null
        };
    } else {
        if (sub.reminderConfig.mode !== "default" &&
            sub.reminderConfig.mode !== "custom" &&
            sub.reminderConfig.mode !== "off") {
            sub.reminderConfig.mode = "default";
        }

        if (typeof sub.reminderConfig.billingLeadDays !== "number") {
            sub.reminderConfig.billingLeadDays = null;
        }

        if (typeof sub.reminderConfig.renewalLeadDays !== "number") {
            sub.reminderConfig.renewalLeadDays = null;
        }
    }

    // --- reminderState -------------------------------------------------------
    if (!sub.reminderState || typeof sub.reminderState !== "object") {
        sub.reminderState = {
            snoozedUntil: null,
            lastNotifiedAt: null,
            lastNotificationType: null
        };
    } else {
        if (typeof sub.reminderState.snoozedUntil !== "string") {
            sub.reminderState.snoozedUntil = null;
        }
        if (typeof sub.reminderState.lastNotifiedAt !== "string") {
            sub.reminderState.lastNotifiedAt = null;
        }
        if (sub.reminderState.lastNotificationType !== "billing" &&
            sub.reminderState.lastNotificationType !== "renewal") {
            sub.reminderState.lastNotificationType = null;
        }
    }

    return sub;
}

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

        // DEV-Funktion: alle Abos normalisieren (Backwards-Kompatibilität zu alten Versionen)
        return parsed.map(normalizeSub);
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

// --- Reminder-Settings (global) ----------------------------------------------

/**
 * Lädt die globalen Reminder-Einstellungen aus localStorage.
 * Wird sowohl in der Web-Version als auch später in der Capacitor-App verwendet.
 */
function loadReminderSettings() {
    try {
        const raw = localStorage.getItem(REMINDER_SETTINGS_KEY);
        if (!raw) {
            return { ...defaultReminderSettings };
        }

        const parsed = JSON.parse(raw);
        // Weiche Zusammenführung: fehlende Felder werden mit Defaults ergänzt
        return {
            ...defaultReminderSettings,
            ...(parsed && typeof parsed === "object" ? parsed : {})
        };
    } catch (err) {
        console.error("Fehler beim Laden der Reminder-Settings:", err);
        return { ...defaultReminderSettings };
    }
}

/**
 * Speichert die globalen Reminder-Einstellungen in localStorage.
 * Diese Funktion bleibt auch mit Capacitor sinnvoll,
 * weil die App-Einstellungen weiterhin im Web-Teil liegen.
 */
function saveReminderSettings(settings) {
    try {
        const serialized = JSON.stringify(settings);
        localStorage.setItem(REMINDER_SETTINGS_KEY, serialized);
    } catch (err) {
        console.error("Fehler beim Speichern der Reminder-Settings:", err);
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
    const categories = getAllCategoriesFromSubs();

    // Formular-Select
    if (categorySelect) {
        const currentValue = categorySelect.value || "";

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
        // Vorherige Auswahl beibehalten, falls noch vorhanden
        categorySelect.value = currentValue || "";
    }

    // Filter-Select
    if (categoryFilterSelect) {
        const currentFilter = categoryFilterSelect.value || "all";

        categoryFilterSelect.innerHTML = "";

        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = "Alle Kategorien";
        categoryFilterSelect.appendChild(optAll);

        const optNone = document.createElement("option");
        optNone.value = "none";
        optNone.textContent = "Ohne Kategorie";
        categoryFilterSelect.appendChild(optNone);

        categories.forEach((cat) => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            categoryFilterSelect.appendChild(opt);
        });

        const hasPrev = Array.from(categoryFilterSelect.options).some(
            (opt) => opt.value === currentFilter
        );
        categoryFilterSelect.value = hasPrev ? currentFilter : "all";
    }
}

function getEffectiveReminderConfig(sub) {
    const globalCfg = reminderSettings || defaultReminderSettings;
    const cfg = sub.reminderConfig || {};

    // Wenn der User für dieses Abo Reminder komplett abgeschaltet hat
    if (cfg.mode === "off") {
        return {
            mode: "off",
            billingLeadDays: null,
            renewalLeadDays: null
        };
    }

    // "default" und alles Unbekannte → globale Defaults
    if (cfg.mode !== "custom" && cfg.mode !== "off") {
        return {
            mode: "default",
            billingLeadDays: globalCfg.billingLeadDays,
            renewalLeadDays: globalCfg.renewalLeadDays
        };
    }

    // mode === "custom": pro Abo definierte Werte, mit Fallback auf global
    const billingLead =
        typeof cfg.billingLeadDays === "number"
            ? cfg.billingLeadDays
            : globalCfg.billingLeadDays;

    const renewalLead =
        typeof cfg.renewalLeadDays === "number"
            ? cfg.renewalLeadDays
            : globalCfg.renewalLeadDays;

    return {
        mode: "custom",
        billingLeadDays: billingLead,
        renewalLeadDays: renewalLead
    };
}

/**
 * Parst ein ISO-Datum im Format "YYYY-MM-DD" in ein Date-Objekt.
 * Gibt null zurück, wenn der String fehlt oder ungültig ist.
 * Wird von Reminder-Engine und später von der Capacitor-Schicht genutzt.
 */
function parseISODate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") {
        return null;
    }

    const parts = dateStr.split("-");
    if (parts.length !== 3) {
        return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) {
        return null;
    }

    // JS-Date: Monate 0–11
    return new Date(year, month - 1, day);
}

/**
 * Formatiert ein Date-Objekt als ISO-Datum "YYYY-MM-DD".
 * Praktisch, um snoozedUntil usw. im Storage zu speichern.
 */
function formatISODate(date) {
    if (!(date instanceof Date)) {
        return "";
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Gibt eine neue Date-Instanz zurück, die um "days" Tage verschoben ist.
 * Input-Date bleibt unverändert.
 */
function addDays(date, days) {
    if (!(date instanceof Date)) {
        return null;
    }
    const result = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + days
    );
    return result;
}

/**
 * Kombiniert ein Datum (YYYY-MM-DD) mit einer Uhrzeit "HH:MM".
 * Nutzt reminderSettings.timeOfDay, damit alle Reminder
 * zur gleichen Tageszeit eingeplant werden können.
 */
function applyTimeOfDay(date, timeOfDay) {
    if (!(date instanceof Date)) {
        return null;
    }

    const timeStr = typeof timeOfDay === "string" && timeOfDay.includes(":")
        ? timeOfDay
        : "09:00";

    const parts = timeStr.split(":");
    const hour = Number(parts[0]) || 9;
    const minute = Number(parts[1]) || 0;

    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hour,
        minute,
        0,
        0
    );
}

/**
 * Formatiert ein Datum in ein kurzes deutsches Format "DD.MM.YYYY".
 */
function formatDateShort(date) {
    if (!(date instanceof Date)) {
        return "";
    }

    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();

    return `${d}.${m}.${y}`;
}

/**
 * Baut eine stabile Notification-ID für ein Abo + Reminder-Typ.
 * Wird später von der Capacitor-Schicht verwendet, um
 * Notifications zu planen / zu aktualisieren / zu löschen.
 */
function buildNotificationId(subId, type) {
    return `${subId}:${type}`;
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

/**
 * Berechnet den nächsten Abbuchungstermin für ein Abo.
 * Gibt ein Date-Objekt zurück oder null, wenn kein Termin ableitbar ist.
 *
 * Aktuelles Modell:
 * - monatliche Abos:
 *     - wenn billingDay gesetzt → fester Tag im Monat (ab Startdatum)
 *     - sonst: Startdatum + n * month
 * - alle anderen Zyklen:
 *     - nur über Startdatum + Zyklus (billingDay wird ignoriert)
 */
function computeNextBillingDate(sub, today = new Date()) {
    const start = parseISODate(sub.startDate);
    if (!start) {
        return null;
    }

    const cycle = sub.cycle || "monthly";
    const billingDay = sub.billingDay ? Number(sub.billingDay) : null;

    // Nur für monatliche Abos einen festen Tag im Monat nutzen
    if (cycle === "monthly" && billingDay && Number.isInteger(billingDay)) {
        return computeNextMonthlyBillingDate(start, billingDay, today);
    }

    // Alle anderen Zyklen (daily, weekly, quarterly, yearly, …)
    // werden rein aus Startdatum + Zyklus berechnet.
    return computeNextByCycle(start, cycle, today);
}

/**
 * Nächster Abbuchungstermin für ein monatliches Abo
 * mit festem Tag im Monat (billingDay), ab Startdatum.
 */
function computeNextMonthlyBillingDate(start, billingDay, today) {
    let year = today.getFullYear();
    let month = today.getMonth();

    // Kandidat: aktueller Monat am billingDay
    let candidate = new Date(year, month, billingDay);

    // Falls vor "heute" → nächsten Monat
    if (candidate < today) {
        month += 1;
        candidate = new Date(year, month, billingDay);
    }

    // Sicherstellen, dass wir nicht vor dem Startdatum liegen
    while (candidate < start) {
        month += 1;
        candidate = new Date(year, month, billingDay);
    }

    return candidate;
}

/**
 * Nächster Termin basierend auf Startdatum + Zyklus.
 */
function computeNextByCycle(start, cycle, today) {
    const next = new Date(start.getTime());

    // Wenn Startdatum bereits in der Zukunft → ist es der nächste Termin
    if (next > today) {
        return next;
    }

    // Sonst so lange addieren, bis wir in der Zukunft sind
    while (next <= today) {
        switch (cycle) {
            case "daily":
                next.setDate(next.getDate() + 1);
                break;

            case "weekly":
                next.setDate(next.getDate() + 7);
                break;

            case "monthly":
                next.setMonth(next.getMonth() + 1);
                break;

            case "quarterly":
                next.setMonth(next.getMonth() + 3);
                break;

            case "yearly":
                next.setFullYear(next.getFullYear() + 1);
                break;

            default:
                next.setMonth(next.getMonth() + 1);
                break;
        }
    }

    return next;
}

/**
 * Berechnet das nächste Verlängerungs-/Ablaufdatum auf Basis von endDate.
 * Gibt ein Date-Objekt zurück oder null, wenn kein sinnvolles Datum existiert.
 */
function computeNextRenewalDate(sub, today = new Date()) {
    const end = parseISODate(sub.endDate);
    if (!end) {
        return null;
    }

    // Wenn das Enddatum in der Vergangenheit oder heute liegt:
    // keine Verlängerungs-Erinnerung mehr planen.
    if (end <= today) {
        return null;
    }

    return end;
}

/**
 * Berechnet den nächsten Reminder für ein Abo.
 * - Snooze (sub.reminderState.snoozedUntil) kann den normalen LeadDay übersteuern.
 * - lastNotifiedAt / lastNotificationType verhindern doppelte Reminder
 *
 * Gibt ein Objekt:
 *  {
 *      subId,
 *      type,           // "billing" | "renewal"
 *      triggerAt,      // Date
 *      notificationId, // string
 *      title,          // string
 *      body            // string
 *  }
 * oder null zurück, wenn aktuell kein Reminder nötig ist.
 */
function getNextReminderForSub(sub, today = new Date()) {
    // Inaktive Abos aktuell komplett von Erinnerungen ausschließen.
    if (!sub.active) {
        return null;
    }

    const effectiveCfg = getEffectiveReminderConfig(sub);
    if (effectiveCfg.mode === "off") {
        return null;
    }

    const billingDate = computeNextBillingDate(sub, today);
    const renewalDate = computeNextRenewalDate(sub, today);

    const state = sub.reminderState || {};
    const snoozedUntil = parseISODate(state.snoozedUntil);

    const candidates = [];

    /**
     * Hilfsfunktion: baut einen Reminder-Kandidaten für einen bestimmten Typ.
     * - eventDate: tatsächlicher Fälligkeitstermin (Abbuchung / Vertragsende)
     * - leadDays: Vorlauf in Tagen
     *
     * Snooze-Regel:
     *   Wenn snoozedUntil gesetzt ist, in der Zukunft liegt und nicht hinter dem Ereignisdatum,
     *   dann wird dieser Tag als Reminder-Datum verwendet, statt eventDate - leadDays.
     */
    function pushCandidate(type, eventDate, leadDays) {
        if (!eventDate || typeof leadDays !== "number" || leadDays < 0) {
            return;
        }

        // "normales" Reminder-Datum (z. B. 3 Tage vor Fälligkeit)
        const leadReminderDate = addDays(eventDate, -leadDays);

        let reminderDate = leadReminderDate;

        // Snooze: gewinnt gegenüber LeadDay, solange sinnvoll
        if (
            snoozedUntil &&
            snoozedUntil >= today &&
            snoozedUntil <= eventDate
        ) {
            reminderDate = snoozedUntil;
        }

        // Nur Reminder in der Zukunft berücksichtigen
        if (!reminderDate || reminderDate < today) {
            return;
        }

        candidates.push({
            type,
            eventDate,
            reminderDate
        });
    }

    // Billing-Reminder (Zahlung)
    pushCandidate("billing", billingDate, effectiveCfg.billingLeadDays);

    // Renewal-Reminder (Vertragsende / Verlängerung)
    pushCandidate("renewal", renewalDate, effectiveCfg.renewalLeadDays);

    if (candidates.length === 0) {
        return null;
    }

    // Frühesten Reminder auswählen
    candidates.sort((a, b) => a.reminderDate - b.reminderDate);
    const chosen = candidates[0];

    // --- Duplicate-Check: schon für genau dieses Datum + Typ erinnert? -----
    const chosenReminderISO = formatISODate(chosen.reminderDate);
    if (
        state.lastNotificationType === chosen.type &&
        state.lastNotifiedAt === chosenReminderISO
    ) {
        // Für dieses Ereignis / Datum wurde bereits eine Notification verschickt
        return null;
    }

    const triggerAt = applyTimeOfDay(
        chosen.reminderDate,
        (reminderSettings && reminderSettings.timeOfDay) || defaultReminderSettings.timeOfDay
    );

    const notificationId = buildNotificationId(sub.id, chosen.type);

    const cycleLabel = (cycles.find((c) => c.value === sub.cycle) || {}).label || sub.cycle;
    const amountPerCycle = money(sub.amount);
    const eventDateLabel = formatDateShort(chosen.eventDate);
    const name = sub.name || "Abo";

    let title = "";
    let body = "";

    if (chosen.type === "billing") {
        title = `${name}: Abbuchung bald fällig`;
        body = `${amountPerCycle} ${cycleLabel}, Termin am ${eventDateLabel}.`;
    } else if (chosen.type === "renewal") {
        title = `${name}: Vertrag läuft bald aus`;
        body = `Vertragsende am ${eventDateLabel}. Bitte rechtzeitig prüfen oder kündigen.`;
    }

    return {
        subId: sub.id,
        type: chosen.type,
        triggerAt,
        notificationId,
        title,
        body
    };
}


/**
 * Berechnet alle anstehenden Reminder für alle Abos.
 * Gibt ein Array von Events zurück, sortiert nach triggerAt.
 */
function computeAllReminders(today = new Date()) {
    const events = subs
        .map((s) => getNextReminderForSub(s, today))
        .filter((evt) => !!evt);

    // Nach Trigger-Zeit sortieren (früheste zuerst)
    events.sort((a, b) => a.triggerAt - b.triggerAt);

    return events;
}

/**
 * DEV ONLY --- KANN SPÄTER GELÖSCHT WERDEN --- :
 * Gibt alle aktuell berechneten Reminder-Events in der Konsole aus.
 * Diese Funktion kann im normalen Betrieb entfernt oder deaktiviert werden.
 */
function logUpcomingReminders() {
    const today = new Date();
    const events = computeAllReminders(today);

    const subById = new Map(subs.map((s) => [s.id, s]));

    // Für einfachere Inspektion in der Dev-Konsole
    console.group("AboChecker – geplante Reminder");
    console.table(
        events.map((evt) => {
            const sub = subById.get(evt.subId);
            const state = (sub && sub.reminderState) || {};
            return {
                subId: evt.subId,
                type: evt.type,
                triggerAt: evt.triggerAt.toISOString(),
                title: evt.title,
                body: evt.body,
                notificationId: evt.notificationId,
                snoozedUntil: state.snoozedUntil || null
            };
        })
    );
    console.groupEnd();
}

// ---------------------------------------------------------------------------
// DEV ONLY – Reminder-Simulation
// Diese Funktionen werden später für die Capacitor-Version nicht mehr benötigt.
// Sie dienen nur der Entwicklung / Debug / Validierung der Reminder-Engine.
// ---------------------------------------------------------------------------

/**
 * Simuliert alle Reminder, die an einem bestimmten Tag fällig wären.
 * dateStr = "YYYY-MM-DD"
 */
function simulateRemindersFor(dateStr) {
    const day = parseISODate(dateStr);
    if (!day) {
        console.error("simulateRemindersFor: Ungültiges Datum:", dateStr);
        return;
    }

    const events = subs
        .map((s) => getNextReminderForSub(s, day))
        .filter((evt) => evt && formatISODate(evt.triggerAt) === dateStr);

    console.group(`Simulierte Reminder für ${dateStr}`);
    console.table(
        events.map((evt) => ({
            subId: evt.subId,
            type: evt.type,
            triggerAt: evt.triggerAt.toISOString(),
            title: evt.title,
            body: evt.body
        }))
    );
    console.groupEnd();

    return events;
}

/**
 * Simuliert Reminder für die nächsten N Tage ab heute.
 */
function simulateNextNDays(n) {
    const results = [];
    const today = new Date();

    console.group(`Reminder-Simulation für die nächsten ${n} Tage`);
    for (let i = 0; i < n; i++) {
        const day = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() + i
        );
        const dateStr = formatISODate(day);

        const events = simulateRemindersFor(dateStr);
        if (events && events.length > 0) {
            results.push({ date: dateStr, events });
        }
    }
    console.groupEnd();

    return results;
}

/**
 * Globale Testfunktion für die Browser-Konsole.
 * Beispiel:
 *   testReminders("2025-12-01");
 *   testReminders(30); // nächste 30 Tage
 */
window.testReminders = function(arg) {
    if (typeof arg === "string") {
        return simulateRemindersFor(arg);
    }

    if (typeof arg === "number" && arg > 0) {
        return simulateNextNDays(arg);
    }

    console.error("testReminders: Bitte Datum (YYYY-MM-DD) oder Anzahl Tage angeben");
};
// ---------------------------------------------------------------------------
//Ab hier wieder normale App-Funktionen
// ---------------------------------------------------------------------------

// --- State -------------------------------------------------------------------
// {id, name, provider, category, amount, cycle, startDate, billingDay, endDate, note, debit, active}
let subs = [];
let formOpen = false;
let formMode = "new"; // "new" | "view" | "edit"
let displayCycle = "monthly";     // NEU: Anzeige-Einheit für Gesamt/Spalte
let searchTerm = "";              // Suchtext für die Liste
//filter states
let statusFilter = "all";       // all | active | inactive
let cycleFilter = "all";        // all | daily | weekly | ...
let categoryFilter = "all";     // all | none | <kategorie>
let isFilterPanelOpen = false;
// Sortier-States
let sortBy = "name";            // "name" | "price" | später: "nextDue"
let sortDir = "asc";            // "asc" | "desc"
// globale Reminder-Einstellungen im Speicher
let reminderSettings = { ...defaultReminderSettings };

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

const filterToggleBtn = document.getElementById("filterToggleBtn");
const filterPanel     = document.getElementById("filterPanel");
const statusFilterSelect   = document.getElementById("statusFilter");
const cycleFilterSelect    = document.getElementById("cycleFilter");
const categoryFilterSelect = document.getElementById("categoryFilter");
const filterResetBtn       = document.getElementById("filterResetBtn");

const sortSelect      = document.getElementById("sortSelect");
const sortDirBtn      = document.getElementById("sortDirBtn");

const reminderBillingInput  = document.getElementById("reminderBillingInput");
const reminderRenewalInput  = document.getElementById("reminderRenewalInput");
const reminderTimeInput     = document.getElementById("reminderTimeInput");
const reminderSettingsToggle = document.getElementById("reminderSettingsToggle");
const reminderSettingsPanel  = document.getElementById("reminderSettingsPanel");

const reminderModeSelect          = document.getElementById("reminderMode");
const reminderCustomWrapper       = document.getElementById("reminderCustomFields");
const reminderBillingCustomInput  = document.getElementById("reminderBillingCustom");
const reminderRenewalCustomInput  = document.getElementById("reminderRenewalCustom");

// --- Init --------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    // zuerst aus Storage laden
    subs = loadSubscriptions();

    // dann UI initialisieren
    init();

    // einmal vollständig rendern
    render();

    // DEV-ONLY: Reminder in der Konsole prüfen
    logUpcomingReminders(); //kann bei overload auskommentiert werden!
});


function init() {
    // Anzeige-Einheit aus Storage laden
    const storedDisplay = getStoredDisplayCycle();
    if (storedDisplay) {
        displayCycle = storedDisplay;
    }
    updateDisplayTexts();
    
    //Reminder-Settings aus Storage laden
    reminderSettings = loadReminderSettings();

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

    // Reminder-Settings-UI initialisieren
    initReminderSettingsUI();

    // Reminder-Settings-Panel ein-/ausklappen
    if (reminderSettingsToggle && reminderSettingsPanel) {
        // Start: zugeklappt
        setReminderPanelOpen(false);

        reminderSettingsToggle.addEventListener("click", () => {
            const isOpen = reminderSettingsPanel.classList.contains("menu__subpanel--open");
            setReminderPanelOpen(!isOpen);
        });
    }

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
    // Klicks auf Menüeinträge schließen menü und führen Aktion aus
    menu.addEventListener("click", (event) => {
        const btn = event.target.closest(".menu__item");
        if (!btn) {
            return;
        }

        const action = btn.dataset.menuAction;
        // Nur echte Menü-Aktionen behandeln, nicht den Reminder-Toggle
        if (!action) {
            return;
        }

        handleMenuAction(action);
    });


    // Kategorie hinzufügen
    if (categoryAddBtn && categorySelect) {
        categoryAddBtn.addEventListener("click", addNewCategoryViaPrompt);
    }

    // Kategorie löschen
    if (categoryDeleteBtn && categorySelect) {
        categoryDeleteBtn.addEventListener("click", deleteSelectedCategory);
    }

    // Filter-Panel ein-/ausblenden
    if (filterToggleBtn && filterPanel) {
        filterToggleBtn.addEventListener("click", () => {
            isFilterPanelOpen = !isFilterPanelOpen;
            filterPanel.classList.toggle("filterPanel--open", isFilterPanelOpen);
            filterToggleBtn.setAttribute("aria-expanded", isFilterPanelOpen ? "true" : "false");
        });
    }

    // Status-Filter
    if (statusFilterSelect) {
        statusFilterSelect.value = statusFilter;
        statusFilterSelect.addEventListener("change", (e) => {
            statusFilter = e.target.value || "all";
            render();
        });
    }

    // Zyklus-Filter
    if (cycleFilterSelect) {
        cycleFilterSelect.value = cycleFilter;
        cycleFilterSelect.addEventListener("change", (e) => {
            cycleFilter = e.target.value || "all";
            render();
        });
    }

    // Kategorie-Filter
    if (categoryFilterSelect) {
        categoryFilterSelect.value = categoryFilter;
        categoryFilterSelect.addEventListener("change", (e) => {
            categoryFilter = e.target.value || "all";
            render();
        });
    }

    // Filter zurücksetzen
    if (filterResetBtn) {
        filterResetBtn.addEventListener("click", () => {
            statusFilter = "all";
            cycleFilter = "all";
            categoryFilter = "all";

            if (statusFilterSelect)   statusFilterSelect.value = "all";
            if (cycleFilterSelect)    cycleFilterSelect.value = "all";
            if (categoryFilterSelect) categoryFilterSelect.value = "all";

            render();
        });
    }

    // Sortierung: Kriterium
    if (sortSelect) {
        sortSelect.value = sortBy;
        sortSelect.addEventListener("change", (e) => {
            sortBy = e.target.value || "name";
            render();
        });
    }

    // Sortierung: Richtung
    if (sortDirBtn) {
        updateSortDirButtonIcon();
        sortDirBtn.addEventListener("click", () => {
            sortDir = sortDir === "asc" ? "desc" : "asc";
            updateSortDirButtonIcon();
            render();
        });
    }

        // Reminder-Mode im Formular
    if (reminderModeSelect) {
        reminderModeSelect.addEventListener("change", () => {
            updateReminderModeUI();
        });
        // Startzustand
        updateReminderModeUI();
    }

    // Startbefüllung Kategorie-Select aus bestehenden Abos
    rebuildCategoryOptions();
}

function initReminderSettingsUI() {
    if (reminderBillingInput) {
        reminderBillingInput.value = String(reminderSettings.billingLeadDays ?? defaultReminderSettings.billingLeadDays);
        reminderBillingInput.addEventListener("change", () => {
            const val = Number(reminderBillingInput.value);
            reminderSettings.billingLeadDays =
                Number.isFinite(val) && val >= 0
                    ? val
                    : defaultReminderSettings.billingLeadDays;

            reminderBillingInput.value = String(reminderSettings.billingLeadDays);
            saveReminderSettings(reminderSettings);
        });
    }

    if (reminderRenewalInput) {
        reminderRenewalInput.value = String(reminderSettings.renewalLeadDays ?? defaultReminderSettings.renewalLeadDays);
        reminderRenewalInput.addEventListener("change", () => {
            const val = Number(reminderRenewalInput.value);
            reminderSettings.renewalLeadDays =
                Number.isFinite(val) && val >= 0
                    ? val
                    : defaultReminderSettings.renewalLeadDays;

            reminderRenewalInput.value = String(reminderSettings.renewalLeadDays);
            saveReminderSettings(reminderSettings);
        });
    }

    if (reminderTimeInput) {
        const timeValue = reminderSettings.timeOfDay || defaultReminderSettings.timeOfDay;
        reminderTimeInput.value = timeValue;

        reminderTimeInput.addEventListener("change", () => {
            const val = reminderTimeInput.value || "";
            // simple validation: muss "HH:MM" enthalten
            reminderSettings.timeOfDay =
                typeof val === "string" && val.includes(":")
                    ? val
                    : defaultReminderSettings.timeOfDay;

            reminderTimeInput.value = reminderSettings.timeOfDay;
            saveReminderSettings(reminderSettings);
        });
    }
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
    let visibleSubs = subs;

    // --- Status-Filter ------------------------------------------------------
    if (statusFilter === "active") {
        visibleSubs = visibleSubs.filter((s) => !!s.active);
    } else if (statusFilter === "inactive") {
        visibleSubs = visibleSubs.filter((s) => !s.active);
    }

    // --- Zyklus-Filter ------------------------------------------------------
    if (cycleFilter !== "all") {
        visibleSubs = visibleSubs.filter((s) => s.cycle === cycleFilter);
    }

    // --- Kategorie-Filter ---------------------------------------------------
    if (categoryFilter === "none") {
        visibleSubs = visibleSubs.filter((s) => !s.category);
    } else if (categoryFilter !== "all") {
        visibleSubs = visibleSubs.filter((s) => (s.category || "") === categoryFilter);
    }

    // --- Suche --------------------------------------------------------------
    if (searchTerm) {
        const term = searchTerm;
        visibleSubs = visibleSubs.filter((s) => {
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

    // --- Sortierung ---------------------------------------------------------
    if (visibleSubs.length > 1) {
        visibleSubs = visibleSubs.slice(); // Kopie, um Original nicht zu verändern

        visibleSubs.sort((a, b) => {
            if (sortBy === "name") {
                const nameA = (a.name || "").toLowerCase();
                const nameB = (b.name || "").toLowerCase();
                if (nameA < nameB) return sortDir === "asc" ? -1 : 1;
                if (nameA > nameB) return sortDir === "asc" ? 1 : -1;
                return 0;
            }

            if (sortBy === "price") {
                const priceA = toDisplayUnit(a.amount, a.cycle, displayCycle);
                const priceB = toDisplayUnit(b.amount, b.cycle, displayCycle);
                if (priceA < priceB) return sortDir === "asc" ? -1 : 1;
                if (priceA > priceB) return sortDir === "asc" ? 1 : -1;
                return 0;
            }

            // Default-Fallback: Name
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            if (nameA < nameB) return sortDir === "asc" ? -1 : 1;
            if (nameA > nameB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });
    }

    // --- Liste + Empty-State ------------------------------------------------
    if (subs.length === 0) {
        // wirklich gar keine Abos angelegt
        emptyEl.style.display = "";
        emptyEl.textContent = "Noch keine Abos hinzugefügt.";
        listEl.innerHTML = "";
    } else if (visibleSubs.length === 0) {
        // es gibt Abos, aber keins passt zur Suche/Filterung
        emptyEl.style.display = "";
        emptyEl.textContent = "Keine passenden Abos gefunden.";
        listEl.innerHTML = "";
    } else {
        emptyEl.style.display = "none";
        listEl.innerHTML = visibleSubs
            .map((s) => {
                const cycleLabel = (cycles.find((c) => c.value === s.cycle) || {}).label || s.cycle;
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

    // --- Summen (immer über alle aktiven, NICHT nur gefilterte) ------------
    const total = subs
        .filter((s) => s.active)
        .reduce(
            (acc, s) => acc + toDisplayUnit(s.amount, s.cycle, displayCycle),
            0
        );

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

    // --- Reminder-Formwerte einsammeln -------------------------------------
    let reminderMode = "default";
    let customBillingDays = null;
    let customRenewalDays = null;

    if (reminderModeSelect) {
        reminderMode = reminderModeSelect.value || "default";
    }

    if (reminderMode === "custom") {
        if (reminderBillingCustomInput) {
            const v = Number(reminderBillingCustomInput.value);
            if (Number.isFinite(v) && v >= 0) {
                customBillingDays = v;
            }
        }
        if (reminderRenewalCustomInput) {
            const v = Number(reminderRenewalCustomInput.value);
            if (Number.isFinite(v) && v >= 0) {
                customRenewalDays = v;
            }
        }
    }

    if (!name || !isFinite(amount) || amount <= 0) {
        return;
    }

    const newReminderConfig = {
        mode: reminderMode,              // "default" | "custom" | "off"
        billingLeadDays: customBillingDays,
        renewalLeadDays: customRenewalDays
    };


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
                    active,
                    // Reminder-Konfiguration aktualisieren
                    reminderConfig: {
                        ...(s.reminderConfig || {}),
                        ...newReminderConfig
                    }
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
                active,

                // Reminder-Konfiguration für dieses Abo
                reminderConfig: newReminderConfig,

                // Reminder-Status (wird von der App / Capacitor gepflegt)
                reminderState: {
                    snoozedUntil: null,
                    lastNotifiedAt: null,
                    lastNotificationType: null
                }
            },
            ...subs
        ];
    }

    resetForm();
    openForm(false);
    render();

    // DEV ONLY: zur Kontrolle der Reminder-Engine
    logUpcomingReminders(); // bei Bedarf auskommentieren
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

    // --- Reminder-Formular mit Abo-spezifischen Einstellungen befüllen -----
    const cfg = s.reminderConfig || {};

    if (reminderModeSelect) {
        const mode = (cfg.mode === "custom" || cfg.mode === "off") ? cfg.mode : "default";
        reminderModeSelect.value = mode;
    }

    if (reminderBillingCustomInput) {
        reminderBillingCustomInput.value =
            typeof cfg.billingLeadDays === "number" ? String(cfg.billingLeadDays) : "";
    }

    if (reminderRenewalCustomInput) {
        reminderRenewalCustomInput.value =
            typeof cfg.renewalLeadDays === "number" ? String(cfg.renewalLeadDays) : "";
    }

    updateReminderModeUI();
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

    if (reminderModeSelect) {
        reminderModeSelect.value = "default";
    }
    if (reminderBillingCustomInput) {
        reminderBillingCustomInput.value = "";
    }
    if (reminderRenewalCustomInput) {
        reminderRenewalCustomInput.value = "";
    }
    updateReminderModeUI();
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

    if (!isOpen) {
        // Reminder-Panel beim Schließen des Menüs einklappen
        setReminderPanelOpen(false);
    }
}

// --- Helpers -----------------------------------------------------------------
//Sortierungsaktualisierung
function updateSortDirButtonIcon() {
    if (!sortDirBtn) {
        return;
    }
    // ↑ = aufsteigend, ↓ = absteigend
    sortDirBtn.textContent = sortDir === "asc" ? "↑" : "↓";
}

function setReminderPanelOpen(isOpen) {
    if (!reminderSettingsPanel) {
        return;
    }
    reminderSettingsPanel.classList.toggle("menu__subpanel--open", isOpen);
    updateReminderSettingsToggleLabel(isOpen);
}

function updateReminderSettingsToggleLabel(isOpen) {
    if (!reminderSettingsToggle) {
        return;
    }
    reminderSettingsToggle.textContent = isOpen
        ? "Erinnerungen ▴"
        : "Erinnerungen ▾";
}

/**
 * Blendet die Custom-Felder im Abo-Formular ein/aus,
 * abhängig vom gewählten reminderMode.
 */
function updateReminderModeUI() {
    if (!reminderModeSelect || !reminderCustomWrapper) {
        return;
    }

    const mode = reminderModeSelect.value || "default";
    const showCustom = mode === "custom";

    reminderCustomWrapper.style.display = showCustom ? "block" : "none";
}

function escapeHTML(str) {
return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
