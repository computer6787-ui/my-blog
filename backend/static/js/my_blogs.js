import { API_URL, ROUTES, notify, confirmDialog } from "./config.js?v=20260913";

// Global functions for inline onclick handlers - must be defined before DOMContentLoaded
window.edit_blog = function (id) {
    window.location.href = `/edit-blog/${id}`;
};

window.delete_blog = async function (id) {
    const confirmed = await confirmDialog({
        title: "Delete Story",
        text: "Are you sure you want to delete this story? This action cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel"
    });

    if (!confirmed) return;

    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_URL}/blog/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
            await notify({ type: "success", title: "Story Deleted", text: "Your story has been removed." });
            window.location.reload();
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            await notify({ type: "warning", title: "Login Required", text: "Please log in again." });
            window.location.href = ROUTES.LOGIN;
        } else if (response.status === 403) {
            await notify({ type: "error", title: "Permission Denied", text: "You can only delete your own stories." });
        } else {
            await notify({ type: "error", title: "Delete Failed", text: "Could not delete the story." });
        }
    } catch (error) {
        console.error("Delete error:", error);
        await notify({ type: "error", title: "Connection Error", text: "Could not connect to the server." });
    }
};


document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token");
    const container = document.getElementById("published-blogs");
    const storyCountBadge = document.getElementById("story-count-badge");
    const loadMoreWrap = document.getElementById("load-more-wrap");
    const loadMoreBtn = document.getElementById("btn-load-more");

    const PAGE_SIZE = 9;
    let allBlogs = [];
    let renderedCount = 0;

    if (!token) {
        await notify({
            type: "warning",
            title: "Login Required",
            text: "Please log in to view your published stories.",
            onClick: () => { window.location.href = ROUTES.LOGIN; }
        });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    function renderBlogCard(blog) {
        const card = document.createElement("div");
        card.className = "user-story-card";
        const palettes = [
            { gradient: "linear-gradient(135deg, #ff6b6b 0%, #a855f7 50%, #6366f1 100%)", icon: "✨" },
            { gradient: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)", icon: "🌊" },
            { gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)", icon: "🌿" },
            { gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f43f5e 100%)", icon: "🚀" }
        ];
        const theme = palettes[blog.id % palettes.length];
        const readTime = `${Math.max(1, Math.ceil((blog.body || "").split(/\s+/).filter(Boolean).length / 180))} min read`;
        const snippetText = ((blog.body || "").replace(/\s+/g, " ").trim());
        const snippet = snippetText.length > 90 ? snippetText.slice(0, 90).trimEnd() + "..." : snippetText;
        const hasImage = Boolean(blog.image_url && blog.image_url.trim().length > 5);

        card.innerHTML = `
            <div class="user-story-media" onclick="window.location.href='/blogs/${blog.id}'">
                ${hasImage ? `
                    <img src="${blog.image_url}" alt="${blog.title || "Story"}" class="user-story-img" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
                    <div class="user-story-placeholder hidden" style="background: ${theme.gradient};">${theme.icon}</div>
                ` : `
                    <div class="user-story-placeholder" style="background: ${theme.gradient};">${theme.icon}</div>
                `}
                <span class="user-story-readtime">⏱ ${readTime}</span>
            </div>
            <div class="user-story-content">
                <h4 class="user-story-title" onclick="window.location.href='/blogs/${blog.id}'">${blog.title || "Untitled"}</h4>
                <p class="user-story-snippet">${snippet}</p>
                <div class="user-story-actions">
                    <button class="btn-story-edit" onclick="edit_blog(${blog.id})" aria-label="Edit story">✎ Edit</button>
                    <button class="btn-story-delete" onclick="delete_blog(${blog.id})" aria-label="Delete story">🗑 Delete</button>
                </div>
            </div>
        `;

        return card;
    }

    function renderBatch() {
        const batch = allBlogs.slice(renderedCount, renderedCount + PAGE_SIZE);
        batch.forEach(blog => container.appendChild(renderBlogCard(blog)));
        renderedCount += batch.length;

        // Show/hide Load More button
        if (loadMoreWrap) {
            loadMoreWrap.style.display = renderedCount < allBlogs.length ? "block" : "none";
        }
        if (loadMoreBtn) {
            loadMoreBtn.textContent = renderedCount < allBlogs.length
                ? `Load More (${allBlogs.length - renderedCount} remaining)`
                : "All stories loaded";
        }
    }

    async function loadMyBlogs() {
        try {
            const response = await fetch(`${API_URL}/user/me`, {
                method: "GET",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error("Failed to load your stories");
            }

            const user = await response.json();
            allBlogs = Array.isArray(user.blogs) ? user.blogs : [];

            // Sort newest first
            allBlogs.sort((a, b) => (b.id || 0) - (a.id || 0));

            if (storyCountBadge) {
                storyCountBadge.textContent = `${allBlogs.length} ${allBlogs.length === 1 ? "story" : "stories"}`;
            }

            if (!container) return;
            container.innerHTML = "";

            if (allBlogs.length === 0) {
                const empty = document.createElement("div");
                empty.className = "empty-blog-state";
                empty.innerHTML = `
                    <div class="empty-icon">✍️</div>
                    <h3>No stories published yet</h3>
                    <p>You haven't written any stories yet. Start sharing your ideas with the Lumora community.</p>
                    <div class="empty-actions">
                        <a href="/create-blog" class="hero-btn hero-btn-primary">Write First Story</a>
                    </div>
                `;
                container.appendChild(empty);
                return;
            }

            // Render first page
            renderBatch();
        } catch (error) {
            console.error(error);
            if (container) {
                container.innerHTML = `
                    <div class="empty-blog-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Unable to load your stories</h3>
                        <p>Please refresh the page or try again later.</p>
                    </div>
                `;
            }
        }
    }

    // Load More button handler
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", () => {
            renderBatch();
        });
    }

    // Intersection Observer for lazy loading cards as they scroll into view
    if ("IntersectionObserver" in window && container) {
        const lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute("data-src");
                    }
                    lazyObserver.unobserve(img);
                }
            });
        }, { rootMargin: "200px" });

        // Observe future images added to the container
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const imgs = node.querySelectorAll ? node.querySelectorAll("img[data-src]") : [];
                        imgs.forEach(img => lazyObserver.observe(img));
                        if (node.dataset?.src) lazyObserver.observe(node);
                    }
                });
            });
        });
        mutationObserver.observe(container, { childList: true, subtree: true });
    }

    await loadMyBlogs();
});
