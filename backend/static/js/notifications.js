// Global notifications system: bell badge, drawer, polling, and click-navigation
(function () {
    const API_URL =
        window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
            ? "http://localhost:8000"
            : "https://lumora-2g3u.onrender.com";

    let unreadCount = 0;
    let pollTimer = null;

    function getToken() {
        try {
            return localStorage.getItem("token");
        } catch (err) {
            return null;
        }
    }

    function isAuthenticated() {
        return Boolean(getToken());
    }

    async function refreshUnreadCount() {
        if (!isAuthenticated()) {
            setBadge(0);
            return;
        }
        try {
            const token = getToken();
            const response = await fetch(`${API_URL}/interact/notifications/unread-count`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include"
            });
            if (response.ok) {
                const data = await response.json();
                setBadge(data.unread_count || 0);
            } else if (response.status === 401) {
                localStorage.removeItem("token");
                setBadge(0);
            }
        } catch (error) {
            // Network errors are silent here
        }
    }

    function setBadge(count) {
        unreadCount = Number(count) || 0;
        const badge = document.getElementById("notif-badge");
        const bell = document.getElementById("notif-bell");
        if (!badge || !bell) return;
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badge.classList.toggle("hidden", unreadCount === 0);
        bell.classList.toggle("has-unread", unreadCount > 0);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
function timeAgo(value) {
        if (!value) return "";
        let date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value))) {
            date = new Date(`${String(value).replace(" ", "T")}Z`);
        }
        const diffMs = Date.now() - date.getTime();
        const seconds = Math.floor(diffMs / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return new Date(date).toLocaleDateString();
    }

    function iconFor(type) {
        const icons = { mention: "@", like: "♥", comment: "💬", reply: "↩️" };
        return icons[type] || "•";
    }

    function renderNotifications(items) {
        const list = document.getElementById("notif-list");
        if (!list) return;

        if (!items || items.length === 0) {
            list.innerHTML = `
                <div class="notif-empty">
                    <span class="notif-empty-icon">🔕</span>
                    <p>No notifications yet.</p>
                    <small>Likes, comments and mentions will show up here.</small>
                </div>
            `;
            return;
        }

        list.innerHTML = items.map((item) => `
            <button type="button"
                class="notif-item ${item.is_read ? "read" : "unread"}"
                data-id="${item.id}"
                data-blog-id="${item.blog_id || ""}"
                data-comment-id="${item.comment_id || ""}"
                title="Open notification">
                <span class="notif-icon ${item.actor_profile_picture_url ? "notif-avatar" : ""}">${item.actor_profile_picture_url ? `<img src="${escapeHtml(item.actor_profile_picture_url)}" alt="${escapeHtml(item.actor_name || "User")}" class="notif-avatar-image" loading="lazy" onerror="this.replaceWith('${iconFor(item.type)}'); this.parentElement.classList.remove('notif-avatar')">` : iconFor(item.type)}</span>
                <span class="notif-body">
                    <span class="notif-message">${escapeHtml(item.message || "New notification")}</span>
                    <span class="notif-time">${timeAgo(item.created_at)}</span>
                </span>
                ${item.is_read ? "" : '<span class="notif-dot"></span>'}
            </button>
        `).join("");
    }
async function openNotifications() {
        const drawer = document.getElementById("notif-drawer");
        if (!drawer) return;

        drawer.classList.add("open");
        if (!isAuthenticated()) {
            renderNotifications([]);
            const list = document.getElementById("notif-list");
            if (list) {
                list.innerHTML = `
                    <div class="notif-empty">
                        <span class="notif-empty-icon">🔒</span>
                        <p>Please log in to see notifications.</p>
                        <a href="/login" class="notif-login-link">Login</a>
                    </div>
                `;
            }
            return;
        }

        try {
            const token = getToken();
            const response = await fetch(`${API_URL}/interact/notifications`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include"
            });
            if (response.ok) {
                const items = await response.json();
                renderNotifications(items);
                setBadge(0);
                // Mark all as read
                fetch(`${API_URL}/interact/notifications/read`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include"
                }).catch(() => {});
            } else if (response.status === 401) {
                localStorage.removeItem("token");
                renderNotifications([]);
            }
        } catch (error) {
            renderNotifications([]);
        }
    }

    function closeNotifications() {
        const drawer = document.getElementById("notif-drawer");
        if (drawer) drawer.classList.remove("open");
    }

    function navigateToNotification(item) {
        const blogId = item.dataset.blogId;
        const commentId = item.dataset.commentId;
        closeNotifications();
        if (!blogId) return;
        const query = commentId ? `?comment=${commentId}` : "";
        window.location.href = `/blogs/${blogId}${query}`;
    }

    function setupListeners() {
        const bell = document.getElementById("notif-bell");
        if (bell) {
            bell.addEventListener("click", (event) => {
                event.stopPropagation();
                const drawer = document.getElementById("notif-drawer");
                if (drawer && drawer.classList.contains("open")) {
                    closeNotifications();
                } else {
                    openNotifications();
                }
            });
        }

        const closeBtn = document.getElementById("notif-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", closeNotifications);
        }

        const drawerNotifLink = document.getElementById("drawer-notif-link");
        if (drawerNotifLink) {
            drawerNotifLink.addEventListener("click", (event) => {
                event.preventDefault();
                // Close the main menu drawer first
                const menuDrawer = document.getElementById("drawer");
                const menuBtn = document.getElementById("menu-btn");
                const overlay = document.querySelector(".overlay");
                if (menuDrawer) menuDrawer.classList.remove("open");
                if (menuBtn) menuBtn.classList.remove("open");
                if (overlay) overlay.classList.remove("visible");
                openNotifications();
            });
        }

        const list = document.getElementById("notif-list");
        if (list) {
            list.addEventListener("click", (event) => {
                const item = event.target.closest(".notif-item");
                if (item) navigateToNotification(item);
            });
        }

        const overlay = document.querySelector(".overlay");
        if (overlay) {
            overlay.addEventListener("click", () => {
                closeNotifications();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeNotifications();
            }
        });
    }

    function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(refreshUnreadCount, 30000);
    }

    function init() {
        setupListeners();
        refreshUnreadCount();
        startPolling();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();