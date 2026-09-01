export const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://lumora-2g3u.onrender.com";

export const ROUTES = {
    HOME: "/",
    LOGIN: "/login",
    PROFILE: "/user",
    CREATE_BLOG: "/create-blog"
};

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function showLoading(message = "Loading...") {
    const loader = document.getElementById("global-loader");
    const loaderText = document.getElementById("global-loader-text");

    if (!loader || !loaderText) return;

    loaderText.textContent = message;
    loader.classList.remove("hidden");
}

export function hideLoading() {
    const loader = document.getElementById("global-loader");

    if (!loader) return;

    loader.classList.add("hidden");
}

export function notify({ type = "info", title = "", text = "", duration = 3200, onClick = null } = {}) {
    if (typeof document === "undefined") {
        return Promise.resolve({ isConfirmed: false, isDenied: false, isDismissed: true, value: null });
    }

    const safeType = ["success", "error", "warning", "info"].includes(type) ? type : "info";
    const container = document.getElementById("lumora-toast-stack") || (() => {
        const stack = document.createElement("div");
        stack.id = "lumora-toast-stack";
        stack.setAttribute("aria-live", "polite");
        document.body.appendChild(stack);
        return stack;
    })();

    const toast = document.createElement("div");
    const safeTitle = escapeHtml(title || "");
    const safeText = escapeHtml(text || "");
    const iconMap = {
        success: "✓",
        error: "✕",
        warning: "!",
        info: "i"
    };

    toast.className = `lumora-toast lumora-toast-${safeType}`;
    toast.style.cursor = "pointer";
    toast.setAttribute("role", "status");
    toast.tabIndex = 0;
    toast.innerHTML = `
        <div class="lumora-toast-icon">${iconMap[safeType] || "i"}</div>
        <div class="lumora-toast-body">
            ${safeTitle ? `<strong>${safeTitle}</strong>` : ""}
            ${safeText ? `<span>${safeText}</span>` : ""}
        </div>
        <button type="button" class="lumora-toast-close" aria-label="Close notification">×</button>
    `;

    let settled = false;
    let timeoutId = null;
    let removeTimerId = null;

    const finish = (reason = "dismiss") => {
        if (settled) {
            return { isConfirmed: false, isDenied: false, isDismissed: true, value: null };
        }

        settled = true;

        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

        toast.classList.remove("show");
        toast.classList.add("hide");

        if (reason === "click" && typeof onClick === "function") {
            onClick();
        }

        if (removeTimerId) clearTimeout(removeTimerId);
        removeTimerId = setTimeout(() => toast.remove(), 220);

        return {
            isConfirmed: reason === "click",
            isDenied: false,
            isDismissed: reason !== "click",
            value: reason === "click" ? true : null
        };
    };

    return new Promise((resolve) => {
        const handleClose = (reason = "dismiss") => {
            resolve(finish(reason));
        };

        const closeButton = toast.querySelector(".lumora-toast-close");

        toast.addEventListener("click", (event) => {
            if (event.target.closest(".lumora-toast-close")) {
                event.stopPropagation();
                handleClose("dismiss");
                return;
            }
            handleClose("click");
        });

        if (closeButton) {
            closeButton.addEventListener("click", (event) => {
                event.stopPropagation();
                handleClose("dismiss");
            });
        }

        if (container && container.isConnected) {
            container.appendChild(toast);
        } else {
            document.body.appendChild(container);
            container.appendChild(toast);
        }

        requestAnimationFrame(() => toast.classList.add("show"));

        if (duration > 0) {
            timeoutId = setTimeout(() => {
                if (!settled) handleClose("timeout");
            }, duration);
        }
    });
}

export function confirmDialog({ title = "Confirm", text = "", confirmText = "Confirm", cancelText = "Cancel" } = {}) {
    return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "lumora-modal-backdrop";

        const modal = document.createElement("div");
        modal.className = "lumora-modal";
        modal.innerHTML = `
            <div class="lumora-modal-header">
                <span class="lumora-modal-badge">✦</span>
                <h3>${escapeHtml(title)}</h3>
            </div>
            <p>${escapeHtml(text)}</p>
            <div class="lumora-modal-actions">
                <button type="button" class="lumora-btn lumora-btn-secondary">${escapeHtml(cancelText)}</button>
                <button type="button" class="lumora-btn lumora-btn-primary">${escapeHtml(confirmText)}</button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const cleanup = () => {
            backdrop.classList.add("hide");
            setTimeout(() => backdrop.remove(), 180);
        };

        modal.querySelector(".lumora-btn-secondary").addEventListener("click", () => {
            cleanup();
            resolve(false);
        });

        modal.querySelector(".lumora-btn-primary").addEventListener("click", () => {
            cleanup();
            resolve(true);
        });

        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                cleanup();
                resolve(false);
            }
        });

        requestAnimationFrame(() => backdrop.classList.add("show"));
    });
}

if (typeof window !== "undefined") {
    window.Swal = {
        fire: (options = {}) => {
            const config = typeof options === "string" ? { title: options } : options;
            const { icon = "info", title = "", text = "", confirmButtonText = "OK", showCancelButton = false, cancelButtonText = "Cancel", timer } = config;

            if (showCancelButton) {
                return confirmDialog({
                    title: title || "Confirm",
                    text: text || "",
                    confirmText: confirmButtonText || "Confirm",
                    cancelText: cancelButtonText || "Cancel"
                }).then((confirmed) => ({
                    isConfirmed: confirmed,
                    isDenied: false,
                    isDismissed: !confirmed,
                    value: confirmed
                }));
            }

            return notify({
                type: icon,
                title,
                text,
                duration: typeof timer === "number" ? timer : 2800
            }).then(() => ({
                isConfirmed: true,
                isDenied: false,
                isDismissed: false,
                value: true
            }));
        },
        close: () => {
            hideLoading();
        },
        showLoading: (message = "Loading...") => {
            showLoading(message);
        }
    };

    window.notify = notify;
    window.confirmDialog = confirmDialog;
}

document.addEventListener("DOMContentLoaded", function () {
    const loader = document.getElementById("global-loader");
    if (loader) {
        loader.classList.add("hidden");
    }
});

