// Shared mention (@user) autocomplete used by the blog editor (create/edit)
// and the comment box. Optimized to be fast and glitch-free:
//  - Debounces keystrokes before hitting the network.
//  - Uses a request sequence token so stale/out-of-order responses are
//    discarded (fixes the "wrong list flashes by" race condition).
//  - Caches the matching users so later keystrokes filter in memory instead
//    of round-tripping to the server.
//  - Positions the dropdown with position:fixed from the input rect, so it
//    works for both the small single-line comment box and the large
//    multi-line editor textarea without depending on a relative wrapper.
import { API_URL } from "./config.js?v=20260902";

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function setupMentionAutocomplete(input, options = {}) {
    if (!input) return;

    const {
        debounceMs = 160,
        limit = 8
    } = options;

    let dropdown = null;
    let usersCache = null; // null = not loaded yet
    let cacheQuery = "";   // query the cache was loaded with (so we refresh when it differs)
    let activeIndex = -1;
    let debounceTimer = null;
    let requestSeq = 0;    // increments each request; stale responses are dropped
    let repositionHandler = null;
    let currentQuery = "";

    function closeDropdown() {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
            activeIndex = -1;
            if (repositionHandler) {
                window.removeEventListener("resize", repositionHandler);
                window.removeEventListener("scroll", repositionHandler, true);
                repositionHandler = null;
            }
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    async function fetchUsers(query) {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(
            `${API_URL}/user/search?q=${encodeURIComponent(query)}&limit=${limit}`,
            { headers }
        );
        if (!response.ok) return [];
        const users = await response.json();
        return users.map(u => ({ name: u.name, id: u.id }));
    }

    function renderDropdown(matchedUsers, query) {
        closeDropdown(); // also clears any pending debounce
        currentQuery = query;

        dropdown = document.createElement("div");
        dropdown.className = "mention-dropdown";
        dropdown.setAttribute("role", "listbox");

        if (matchedUsers.length === 0) {
            dropdown.innerHTML = '<div class="mention-empty">No users found</div>';
        } else {
            dropdown.innerHTML = matchedUsers.map((user, idx) => `
                <button type="button" class="mention-option ${idx === activeIndex ? "active" : ""}"
                        data-username="${escapeHtml(user.name)}" data-index="${idx}">
                    <span class="mention-avatar">${escapeHtml((user.name || "?")[0].toUpperCase())}</span>
                    <span class="mention-name">@${escapeHtml(user.name)}</span>
                </button>
            `).join("");
        }

        document.body.appendChild(dropdown);
        try { positionDropdown(); } catch (e) { /* positioning is best-effort; clicks must still work */ }

        // Primary path: mousedown with preventDefault() keeps focus inside the
        // textarea (so the blur handler never races to close the dropdown) while
        // inserting the mention immediately.
        dropdown.querySelectorAll(".mention-option").forEach(option => {
            option.addEventListener("mousedown", (e) => {
                e.preventDefault();
                triggerInsert(option.dataset.username);
            });
        });

        // Fallback path: a guarded delegated click handler catches any mention
        // option click that didn't go through mousedown (e.g. touch emulation
        // or environments that only synthesize click). triggerInsert is
        // idempotent so a normal mousedown->click sequence inserts once.
        dropdown.addEventListener("click", (e) => {
            const option = e.target.closest(".mention-option");
            if (option) triggerInsert(option.dataset.username);
        });

        if (!repositionHandler) {
            repositionHandler = () => positionDropdown();
            window.addEventListener("resize", repositionHandler);
            window.addEventListener("scroll", repositionHandler, true);
        }
    }

    function positionDropdown() {
        if (!dropdown || !input) return;
        const rect = input.getBoundingClientRect();
        const dropdownHeight = dropdown.offsetHeight || 0;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < dropdownHeight + 8 && rect.top > spaceBelow;
        dropdown.style.position = "fixed";
        if (openAbove) {
            dropdown.style.top = `${Math.max(8, rect.top - dropdownHeight - 6)}px`;
        } else {
            dropdown.style.top = `${rect.bottom + 6}px`;
        }
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.width = `${Math.min(rect.width, 320)}px`;
    }

    let lastInsertTime = 0;
    // Idempotent insert guard: both mousedown and click fire for a single mouse
    // action, so we only perform the actual insertion once. 400ms is plenty of
    // headroom for the mousedown->click sequence while still allowing the user
    // to insert the same name again later.
    function triggerInsert(username) {
        if (!username) return;
        const now = Date.now();
        if (now - lastInsertTime < 400) return;
        lastInsertTime = now;
        insertMention(username);
    }

    function insertMention(username) {
        const value = input.value;
        const caret = input.selectionStart ?? value.length;
        const before = value.slice(0, caret);
        const atIdx = before.lastIndexOf("@");
        const start = atIdx === -1 ? caret : atIdx;

        // setRangeText keeps native undo/redo history and works on textareas.
        input.setRangeText(`@${username} `, Math.max(0, start), caret, "end");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
        closeDropdown();
    }

    function updateActiveOption() {
        if (!dropdown) return;
        dropdown.querySelectorAll(".mention-option").forEach(opt => {
            opt.classList.toggle("active", Number(opt.dataset.index) === activeIndex);
        });
        const active = dropdown.querySelector(".mention-option.active");
        if (active && typeof active.scrollIntoView === "function") {
            active.scrollIntoView({ block: "nearest" });
        }
    }

    // Core handler. Debounced, race-safe, cache-aware.
    function onInput() {
        const value = input.value;
        const caret = input.selectionStart ?? value.length;
        const before = value.slice(0, caret);
        // Allow multi-word names, e.g. typing "@John Doe" matches the full name.
        const match = before.match(/@([\w][\w ]*)$/);

        // Only act when the caret is at the very end of the token and after "@".
        if (!match || caret < value.length) {
            closeDropdown();
            return;
        }
        const query = (match[1] || "").trim();
        if (!query) {
            closeDropdown();
            return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const q = query.toLowerCase();
            // If the cache already covers this query's prefix, filter locally —
            // no network call, so it feels instant.
            if (usersCache && cacheQuery && q.startsWith(cacheQuery.toLowerCase())) {
                const matched = usersCache.filter(u => u.name.toLowerCase().includes(q));
                activeIndex = 0;
                renderDropdown(matched, query);
                updateActiveOption();
                return;
            }

            // Otherwise fetch once and cache, guarding against stale responses.
            const seq = ++requestSeq;
            const qForFetch = q;
            fetchUsers(qForFetch).then(users => {
                if (seq !== requestSeq) return; // a newer request superseded this one
                usersCache = users;
                cacheQuery = qForFetch;
                if (usersCache.length === 0) {
                    const current = input.value.slice(0, input.selectionStart ?? input.value.length);
                    // Still at a mention query? (multi-word names supported)
                    if (!/@([\w][\w ]*)$/.test(current)) {
                        closeDropdown();
                        return;
                    }
                }
                activeIndex = 0;
                renderDropdown(usersCache, qForFetch);
                updateActiveOption();
            }).catch(() => {
                if (seq === requestSeq) closeDropdown();
            });
        }, debounceMs);
    }

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", (e) => {
        if (!dropdown) return;
        const options = dropdown.querySelectorAll(".mention-option");
        if (options.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % options.length;
            updateActiveOption();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + options.length) % options.length;
            updateActiveOption();
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const active = dropdown.querySelector(".mention-option.active");
            if (active) triggerInsert(active.dataset.username);
        } else if (e.key === "Escape") {
            closeDropdown();
        }
    });

    // Keep the dropdown from closing while the user is still interacting with
    // it. Clicking an option is handled on mousedown (which calls
    // preventDefault, so focus never leaves the textarea), but guarding the
    // blur timer against clicks inside the dropdown removes any chance of the
    // dropdown being torn down mid-click sequence.
    input.addEventListener("blur", (e) => {
        const related = e.relatedTarget;
        if (dropdown && related && dropdown.contains(related)) return;
        setTimeout(() => {
            if (dropdown) closeDropdown();
        }, 150);
    });
}
