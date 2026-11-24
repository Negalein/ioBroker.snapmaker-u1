"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpoolmanService = void 0;
exports.spoolSlot = spoolSlot;
exports.inWindow = inWindow;
exports.validateSpoolman = validateSpoolman;
/**
 * Converts API data without treating unknown weights as an empty spool.
 *
 * @param value
 * @param lane
 * @param warn
 * @param empty
 */
function spoolSlot(value, lane, warn, empty) {
    const s = value;
    if (!s || !Number.isInteger(s.id) || !s.filament || s.archived) {
        throw new Error("Invalid or archived spool");
    }
    const remaining = s.remaining_weight;
    if (typeof remaining !== "number" || !Number.isFinite(remaining)) {
        throw new Error("Spool has no remaining weight");
    }
    return {
        active: true,
        extruder: `T${lane}`,
        lane: `E${lane}`,
        spool_id: s.id,
        name: String(s.filament.name ?? ""),
        material: String(s.filament.material ?? ""),
        color: String(s.filament.color_hex ?? ""),
        initial_weight: Number(s.initial_weight ?? s.filament.weight) || 0,
        used_weight: Number(s.used_weight) || 0,
        remaining_weight: remaining,
        status: remaining < empty ? "LEER" : remaining < warn ? "WARN" : "OK",
    };
}
/**
 * Evaluates local wall-clock windows, including windows crossing midnight.
 *
 * @param now
 * @param start
 * @param end
 */
function inWindow(now, start, end) {
    const hour = now.getHours() + now.getMinutes() / 60;
    return start === end || (start < end ? hour >= start && hour < end : hour >= start || hour < end);
}
/**
 * Validates all settings before any requests or compatibility writes.
 *
 * @param c
 */
function validateSpoolman(c) {
    const url = new URL(c.spoolmanUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error("Configure a Spoolman HTTP(S) base URL without credentials, query or fragment");
    }
    for (const n of [c.spoolmanWarnLimit, c.spoolmanEmptyLimit]) {
        if (!Number.isFinite(n) || n < 0) {
            throw new Error("Invalid Spoolman thresholds");
        }
    }
    if (c.spoolmanEmptyLimit >= c.spoolmanWarnLimit) {
        throw new Error("Empty threshold must be below warning threshold");
    }
    for (const n of [c.spoolmanWeekdayStart, c.spoolmanWeekdayEnd, c.spoolmanWeekendStart, c.spoolmanWeekendEnd]) {
        if (!Number.isFinite(n) || n < 0 || n > 24) {
            throw new Error("Warning hours must be between 0 and 24");
        }
    }
    if (!Number.isFinite(c.spoolmanInterval) || c.spoolmanInterval < 5 || c.spoolmanInterval > 3600) {
        throw new Error("Spoolman interval must be 5–3600 seconds");
    }
    if (c.spoolmanTelegramEnabled && !/^telegram\.\d+$/.test(c.spoolmanTelegramInstance)) {
        throw new Error("Invalid Telegram instance");
    }
    url.pathname = `${url.pathname.replace(/\/$/, "")}/`;
    return url;
}
const blank = {
    active: false,
    extruder: "",
    lane: "",
    spool_id: 0,
    name: "",
    material: "",
    color: "",
    initial_weight: 0,
    used_weight: 0,
    remaining_weight: 0,
    status: "INAKTIV",
    warnung: false,
    alarm: false,
};
/** Read-only Spoolman service. Never sends printer commands or accounts consumption. */
class SpoolmanService {
    adapter;
    stopped = false;
    generation = 0;
    running = false;
    pending;
    lastFetch = 0;
    lastIds = "";
    cache = new Map();
    abort;
    objects = new Set();
    base;
    /** Initializes the validated read-only service. */
    constructor(adapter) {
        this.adapter = adapter;
        this.base = validateSpoolman(adapter.config);
    }
    /** Resets persisted health before accepting the first live printer snapshot. */
    async initialize() {
        await this.write("apiConnected", false);
        await this.write("druck_laeuft", false);
    }
    /** Invalidates queued/in-flight snapshots when the printer becomes unavailable. */
    async disconnect(reason) {
        if (this.stopped) {
            return;
        }
        this.generation++;
        this.pending = undefined;
        this.abort?.abort();
        this.lastIds = "";
        this.lastFetch = 0;
        this.cache.clear();
        await this.write("apiConnected", false);
        await this.write("druck_laeuft", false);
        await this.write("lastError", reason);
    }
    /** Cancels outstanding work and persists offline health before unload completes. */
    async stop() {
        this.stopped = true;
        this.generation++;
        this.pending = undefined;
        this.abort?.abort();
        await this.adapter.setStateChangedAsync("spoolman.apiConnected", false, true);
        await this.adapter.setStateChangedAsync("spoolman.druck_laeuft", false, true);
    }
    /** Queues the latest complete printer snapshot. */
    request(status) {
        if (this.stopped) {
            return;
        }
        this.pending = status;
        if (!this.running) {
            void this.drain().catch(error => this.adapter.log.debug(`Spoolman state update failed: ${String(error)}`));
        }
    }
    async drain() {
        this.running = true;
        try {
            while (this.pending && !this.stopped) {
                const status = this.pending;
                const generation = this.generation;
                this.pending = undefined;
                try {
                    await this.update(status, generation);
                }
                catch (e) {
                    if (!this.stopped && generation === this.generation) {
                        this.lastIds = "";
                        await this.write("apiConnected", false, generation);
                        await this.write("lastError", e instanceof Error ? e.message : "Spoolman request failed", generation);
                        this.adapter.log.debug(`Spoolman update failed: ${String(e)}`);
                    }
                }
            }
        }
        finally {
            this.running = false;
        }
    }
    async write(id, value, generation = this.generation) {
        if (this.stopped || generation !== this.generation) {
            return;
        }
        const own = `spoolman.${id}`;
        if (!this.objects.has(own)) {
            const parts = own.split(".");
            for (let i = 1; i < parts.length; i++) {
                await this.adapter.setObjectNotExistsAsync(parts.slice(0, i).join("."), {
                    type: "channel",
                    common: { name: parts[i - 1] },
                    native: {},
                });
            }
            await this.adapter.setObjectNotExistsAsync(own, {
                type: "state",
                common: {
                    name: id,
                    type: typeof value,
                    role: typeof value === "boolean" ? "indicator" : typeof value === "number" ? "value" : "text",
                    read: true,
                    write: false,
                    ...(id.endsWith("weight") ? { unit: "g" } : {}),
                },
                native: {},
            });
            this.objects.add(own);
        }
        if (this.stopped || generation !== this.generation) {
            return;
        }
        await this.adapter.setStateChangedAsync(own, value, true);
    }
    async update(status, generation) {
        const write = (id, value) => this.write(id, value, generation);
        const c = this.adapter.config;
        const now = new Date();
        const weekend = [0, 6].includes(now.getDay());
        const window = inWindow(now, weekend ? c.spoolmanWeekendStart : c.spoolmanWeekdayStart, weekend ? c.spoolmanWeekendEnd : c.spoolmanWeekdayEnd);
        const printing = status.print_stats?.state === "printing";
        await write("warnzeit_aktiv", window);
        await write("druck_laeuft", printing);
        // Missing AFC telemetry is unknown, not an unloaded lane.
        const ids = Array.from({ length: 4 }, (_, i) => status[`AFC_lane E${i}`]?.spool_id);
        if (ids.some(id => id === undefined)) {
            throw new Error("Incomplete AFC lane telemetry; previous spool values retained");
        }
        const signature = JSON.stringify(ids);
        const due = signature !== this.lastIds || Date.now() - this.lastFetch >= c.spoolmanInterval * 1000;
        this.abort = new AbortController();
        const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(10000)]);
        const data = due ? new Map() : this.cache;
        for (const raw of ids) {
            const id = Number(raw);
            if (raw === null || raw === "" || id === 0 || id === -1) {
                continue;
            }
            if (!Number.isSafeInteger(id) || id < 1) {
                throw new Error("Invalid AFC spool ID");
            }
            if (due && !data.has(id)) {
                const response = await fetch(new URL(`api/v1/spool/${id}`, this.base), { signal });
                if (!response.ok) {
                    throw new Error(`Spoolman spool ${id}: HTTP ${response.status}`);
                }
                const value = await response.json();
                if (value?.id !== id) {
                    throw new Error("Spoolman returned a different spool ID");
                }
                data.set(id, value);
            }
        }
        const slots = ids.map((id, i) => data.has(Number(id))
            ? spoolSlot(data.get(Number(id)), i, c.spoolmanWarnLimit, c.spoolmanEmptyLimit)
            : { ...blank });
        // Drop an obsolete response if a newer printer snapshot arrived during HTTP requests.
        const newerIds = this.pending &&
            JSON.stringify(Array.from({ length: 4 }, (_, i) => this.pending?.[`AFC_lane E${i}`]?.spool_id));
        const newerPrinting = this.pending && this.pending.print_stats?.state === "printing";
        if (this.stopped ||
            generation !== this.generation ||
            (this.pending && (newerIds !== signature || newerPrinting !== printing))) {
            return;
        }
        for (let i = 0; i < 4; i++) {
            const slot = slots[i];
            const prefix = `aktiv.${i + 1}`;
            const oldId = (await this.adapter.getStateAsync(`spoolman.${prefix}.spool_id`))?.val;
            const same = oldId === slot.spool_id && slot.active;
            let warned = same && (await this.adapter.getStateAsync(`spoolman.${prefix}.warnung`))?.val === true;
            let alarmed = same && (await this.adapter.getStateAsync(`spoolman.${prefix}.alarm`))?.val === true;
            if (slot.status === "OK") {
                warned = false;
                alarmed = false;
            }
            const alarm = slot.status === "LEER";
            if (slot.active &&
                c.spoolmanTelegramEnabled &&
                printing &&
                (alarm ? (!c.spoolmanAlarmInWindow || window) && !alarmed : slot.status === "WARN" && window && !warned)) {
                if (this.stopped || generation !== this.generation) {
                    return;
                }
                const reply = await this.adapter.sendToAsync(c.spoolmanTelegramInstance, "send", {
                    text: `${alarm ? "🔴 FILAMENT FAST LEER!" : "🟡 Filament wird knapp"}\nSnapmaker U1 · ${slot.extruder} / ${slot.lane}\n${slot.name} (${slot.material})\nRestfilament: ${slot.remaining_weight} g`,
                    ...(c.spoolmanTelegramUser ? { user: c.spoolmanTelegramUser } : {}),
                }, { timeout: 10000 });
                if (reply && typeof reply === "object" && "error" in reply && reply.error) {
                    throw new Error("Telegram rejected the notification");
                }
                if (alarm) {
                    alarmed = true;
                }
                else {
                    warned = true;
                }
            }
            slot.warnung = Boolean(warned);
            slot.alarm = Boolean(alarmed);
            for (const [key, value] of Object.entries(slot)) {
                await write(`${prefix}.${key}`, value);
            }
        }
        if (this.stopped || generation !== this.generation) {
            return;
        }
        this.lastIds = signature;
        if (due) {
            this.lastFetch = Date.now();
            this.cache = data;
        }
        await write("apiConnected", true);
        await write("lastError", "");
        await write("lastUpdate", this.lastFetch);
    }
}
exports.SpoolmanService = SpoolmanService;
//# sourceMappingURL=spoolman.js.map