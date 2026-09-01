import { API_URL, ROUTES, notify } from "./config.js?v=20260818";

// Global functions for inline onclick handlers - must be defined before DOMContentLoaded
window.edit_blog = function (id) {
    window.location.href = `/edit-blog/${id}`;
};

window.delete_blog = function (id) {
    window.location.href = `/delete-blog/${id}`;
};


document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token");
    const container = document.getElementById("published-blogs");
    const storyCountBadge = document.getElementById("story-count-badge");

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
            const blogs = Array.isArray(user.blogs) ? user.blogs : [];

            if (storyCountBadge) {
                storyCountBadge.textContent = `${blogs.length} ${blogs.length === 1 ? "story" : "stories"}`;
            }

            if (!container) return;
            container.innerHTML = "";

            if (blogs.length === 0) {
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

            const palettes = [
                { gradient: "linear-gradient(135deg, #ff6b6b 0%, #a855f7 50%, #6366f1 100%)", icon: "✨" },
                { gradient: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)", icon: "🌊" },
                { gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)", icon: "🌿" },
                { gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f43f5e 100%)", icon: "🚀" }
            ];

            [...blogs].reverse().forEach((blog) => {
                const card = document.createElement("div");
                card.className = "user-story-card";
                const theme = palettes[blog.id % palettes.length];
                const readTime = `${Math.max(1, Math.ceil((blog.body || "").split(/\s+/).filter(Boolean).length / 180))} min read`;
                const snippetText = ((blog.body || "").replace(/\s+/g, " ").trim());
                const snippet = snippetText.length > 90 ? snippetText.slice(0, 90).trimEnd() + "..." : snippetText;
                const hasImage = Boolean(blog.image_url && blog.image_url.trim().length > 5);

                card.innerHTML = `
                    <div class="user-story-media" onclick="window.location.href='/blogs/${blog.id}'">
                        ${hasImage ? `
                            <img src="${blog.image_url}" alt="${blog.title || "Story"}" class="user-story-img" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
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

                container.appendChild(card);
            });
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

    await loadMyBlogs();
});

