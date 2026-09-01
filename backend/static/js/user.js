import { API_URL, ROUTES, notify, confirmDialog } from "./config.js?v=20260818";

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token");
    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const nameInput = document.getElementById("name-input");
    const toggleNameBtn = document.getElementById("toggle-name-edit");
    const nameMessage = document.getElementById("name-message");
    const profileLoading = document.getElementById("profile-loading");
    const container = document.getElementById("published-blogs");

    let originalName = "";

    if (!token) {
        await notify({
            type: "warning",
            title: "Login Required",
            text: "Please log in to visit your profile.",
            onClick: () => {
                window.location.href = ROUTES.LOGIN;
            }
        });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    function setProfileLoading(isVisible, message = "Loading profile...") {
        if (!profileLoading) return;
        profileLoading.classList.toggle("hidden", !isVisible);
        const text = profileLoading.querySelector("span");
        if (text) text.textContent = message;
    }

    function updateNameButtonState() {
        if (!toggleNameBtn || !nameInput) return;
        const currentValue = nameInput.value.trim();
        const isDirty = currentValue && currentValue !== originalName;
        toggleNameBtn.textContent = isDirty ? "✓" : "✎";
        toggleNameBtn.setAttribute("aria-label", isDirty ? "Save name" : "Edit name");
        toggleNameBtn.classList.toggle("publish-button", isDirty);
    }

    function openNameEditor() {
        if (!nameInput || !nameEl || !toggleNameBtn) return;
        nameInput.classList.remove("hidden");
        nameEl.classList.add("hidden");
        nameInput.value = originalName;
        nameInput.focus();
        updateNameButtonState();
    }

    function closeNameEditor() {
        if (!nameInput || !nameEl || !toggleNameBtn) return;
        nameInput.classList.add("hidden");
        nameEl.classList.remove("hidden");
        nameInput.value = "";
        toggleNameBtn.textContent = "✎";
        toggleNameBtn.setAttribute("aria-label", "Edit name");
        toggleNameBtn.classList.remove("publish-button");
    }

    async function saveName() {
        if (!nameInput) return;

        const nextName = nameInput.value.trim();

        if (!nextName) {
            nameMessage.textContent = "Please enter a name before saving.";
            nameMessage.style.color = "#d93025";
            return;
        }

        if (nextName === originalName) {
            closeNameEditor();
            nameMessage.textContent = "";
            return;
        }

        nameMessage.textContent = "Saving your name...";
        nameMessage.style.color = "var(--muted)";

        try {
            const response = await fetch(`${API_URL}/user/edit_name`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: nextName })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.detail || "Failed to update name");
            }

            originalName = nextName;
            if (nameEl) nameEl.textContent = nextName;
            nameMessage.textContent = "Name updated successfully.";
            nameMessage.style.color = "#1f9d5a";
            closeNameEditor();

            await notify({
                type: "success",
                title: "Success!",
                text: "Your name has been updated."
            });
        } catch (error) {
            console.error(error);
            nameMessage.textContent = error.message || "Could not update name.";
            nameMessage.style.color = "#d93025";
            await notify({
                type: "error",
                title: "Update failed",
                text: error.message || "Could not update name."
            });
        }
    }

    if (toggleNameBtn) {
        toggleNameBtn.addEventListener("click", function () {
            if (nameInput.classList.contains("hidden")) {
                openNameEditor();
                return;
            }

            const currentValue = nameInput.value.trim();
            if (currentValue && currentValue !== originalName) {
                saveName();
                return;
            }

            closeNameEditor();
        });
    }

    if (nameInput) {
        nameInput.addEventListener("input", updateNameButtonState);
        nameInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                saveName();
            }
        });
    }

    async function loadUser() {
        setProfileLoading(true, "Loading profile...");

        try {
            const response = await fetch(`${API_URL}/user/me`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error("Failed to load user profile");
            }

            const user = await response.json();
            const blogs = Array.isArray(user.blogs) ? user.blogs : [];
            originalName = user.name || "";

            if (nameEl) nameEl.textContent = originalName || "Author";
            if (emailEl) emailEl.textContent = user.email || "No email";
            
            const avatarEl = document.getElementById("profile-avatar");
            if (avatarEl) {
                avatarEl.textContent = (originalName[0] || "L").toUpperCase();
            }

            const storyCountBadge = document.getElementById("story-count-badge");
            if (storyCountBadge) {
                storyCountBadge.textContent = `${blogs.length} ${blogs.length === 1 ? "story" : "stories"}`;
            }

            if (nameInput) nameInput.value = "";
            closeNameEditor();

            if (container) {
                container.innerHTML = "";

                if (blogs.length === 0) {
                    const emptyState = document.createElement("div");
                    emptyState.className = "empty-blog-state";
                    emptyState.innerHTML = `
                        <div class="empty-icon">✍️</div>
                        <h3>No stories published yet</h3>
                        <p>You haven't written any stories yet. Start sharing your ideas with the Lumora community!</p>
                        <div class="empty-actions">
                            <a href="/create-blog" class="hero-btn hero-btn-primary">Write First Story</a>
                        </div>
                    `;
                    container.appendChild(emptyState);
                    return;
                }

                const PALETTES = [
                    { gradient: "linear-gradient(135deg, #ff6b6b 0%, #a855f7 50%, #6366f1 100%)", icon: "✨" },
                    { gradient: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)", icon: "🌊" },
                    { gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)", icon: "🌿" },
                    { gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f43f5e 100%)", icon: "🚀" },
                    { gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)", icon: "💡" },
                    { gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)", icon: "🔮" }
                ];

                [...blogs].reverse().forEach(blog => {
                    const card = document.createElement("div");
                    card.className = "user-story-card";

                    const hasImage = Boolean(blog.image_url && blog.image_url.trim().length > 5);
                    const cleanImageUrl = hasImage ? blog.image_url.trim() : "";
                    const theme = PALETTES[blog.id % PALETTES.length];
                    const readTime = `${Math.max(1, Math.ceil((blog.body || "").split(/\s+/).filter(Boolean).length / 180))} min read`;
                    const snippet = (blog.body || "").slice(0, 90) + (blog.body?.length > 90 ? "..." : "");

                    card.innerHTML = `
                        <div class="user-story-media" onclick="window.location.href='/blogs/${blog.id}'">
                            ${hasImage ? `
                                <img src="${cleanImageUrl}" alt="${blog.title || 'Story'}" class="user-story-img" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
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
            }
        } catch (error) {
            console.error(error);
            await notify({
                type: "error",
                title: "Error",
                text: "Failed to load user profile"
            });
        } finally {
            setProfileLoading(false);
        }
    }


    await loadUser();

    window.delete_blog = async function (id) {
        const confirmed = await confirmDialog({
            title: "Delete Story",
            text: "Are you sure you want to delete this story? This action cannot be undone.",
            confirmText: "Delete",
            cancelText: "Cancel"
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/blog/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                await notify({
                    type: "success",
                    title: "Story Deleted",
                    text: "Your story was deleted successfully."
                });
                window.location.reload();
            } else {
                await notify({
                    type: "error",
                    title: "Delete Failed",
                    text: "Failed to delete the story."
                });
            }
        } catch (error) {
            console.error(error);
            await notify({
                type: "error",
                title: "Connection Error",
                text: "Could not connect to the server."
            });
        }
    };

    window.edit_blog = function (id) {
        window.location.href = `/edit-blog/${id}`;
    };
});
