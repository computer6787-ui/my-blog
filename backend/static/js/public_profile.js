import { API_URL } from "./config.js?v=20260818";

document.addEventListener("DOMContentLoaded", async function () {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const userId = Number(pathParts[pathParts.length - 1]);
    const container = document.getElementById("published-blogs");
    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const bioEl = document.getElementById("bio");
    const avatarEl = document.getElementById("profile-avatar");
    const locationRow = document.getElementById("location-row");
    const hobbyRow = document.getElementById("hobby-row");
    const occupationRow = document.getElementById("occupation-row");
    const educationRow = document.getElementById("education-row");
    const facebookRow = document.getElementById("facebook-row");
    const instagramRow = document.getElementById("instagram-row");
    const locationText = document.getElementById("location-text");
    const hobbyText = document.getElementById("hobby-text");
    const occupationText = document.getElementById("occupation-text");
    const educationText = document.getElementById("education-text");
    const facebookText = document.getElementById("facebook-text");
    const instagramText = document.getElementById("instagram-text");
    const storyCountBadge = document.getElementById("story-count-badge");

    async function loadPublicProfile() {
        try {
            const response = await fetch(`${API_URL}/user/${userId}`);
            if (!response.ok) {
                throw new Error("Profile not found");
            }

            const user = await response.json();
            const blogs = Array.isArray(user.blogs) ? user.blogs : [];

            if (nameEl) nameEl.textContent = user.name || "Author";
            if (emailEl) emailEl.textContent = user.email || "No email";
            if (bioEl) bioEl.textContent = user.bio || "No bio yet.";

            const profilePicture = user.profile_picture_url || "";
            if (avatarEl) {
                if (profilePicture) {
                    avatarEl.style.backgroundImage = `url("${profilePicture}")`;
                    avatarEl.style.backgroundSize = "cover";
                    avatarEl.style.backgroundPosition = "center";
                    avatarEl.textContent = "";
                } else {
                    avatarEl.style.backgroundImage = "";
                    avatarEl.style.backgroundSize = "";
                    avatarEl.style.backgroundPosition = "";
                    avatarEl.textContent = (user.name || "A").charAt(0).toUpperCase();
                }
            }

            const metaItems = [
                { row: locationRow, text: locationText, value: user.location },
                { row: hobbyRow, text: hobbyText, value: user.hobby },
                { row: occupationRow, text: occupationText, value: user.occupation },
                { row: educationRow, text: educationText, value: user.education },
                { row: facebookRow, text: facebookText, value: user.facebook },
                { row: instagramRow, text: instagramText, value: user.instagram }
            ];

            metaItems.forEach(({ row, text, value }) => {
                if (!row || !text) return;
                if (value && value.trim()) {
                    row.classList.remove("hidden");
                    text.textContent = value.trim();
                } else {
                    row.classList.add("hidden");
                }
            });

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
                    <p>This author has not shared any stories yet.</p>
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
                const hasImage = !!(blog.image_url && blog.image_url.trim().length > 5);

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
                    </div>
                `;
                container.appendChild(card);
            });
        } catch (error) {
            console.error(error);
            if (nameEl) nameEl.textContent = "Profile unavailable";
            if (bioEl) bioEl.textContent = "This profile could not be loaded.";
        }
    }

    if (!Number.isFinite(userId) || userId <= 0) {
        if (nameEl) nameEl.textContent = "Invalid profile";
        return;
    }

    await loadPublicProfile();
});
