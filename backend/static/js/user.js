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
                throw new Error("Failed to load user");
            }

            const user = await response.json();
            const blogs = Array.isArray(user.blogs) ? user.blogs : [];
            originalName = user.name || "";

            if (nameEl) nameEl.textContent = originalName || "No name set";
            if (emailEl) emailEl.textContent = user.email || "No email set";
            if (nameInput) nameInput.value = "";
            closeNameEditor();

            if (container) {
                container.innerHTML = `
                    <hr>
                    <h4>Blogs:</h4>
                    <br>
                    <br>
                    <hr>
                `;

                if (blogs.length === 0) {
                    const emptyState = document.createElement("p");
                    emptyState.className = "empty-state";
                    emptyState.textContent = "You have not published any blogs yet.";
                    container.appendChild(emptyState);
                    return;
                }

                [...blogs].reverse().forEach(blog => {
                    const card = document.createElement("div");
                    card.className = "personalBlog-card";

                    card.innerHTML = `
                        <hr>
                        <h2>${blog.title}</h2>
                        <p>${blog.body.slice(0, 70)}...</p>
                        <button class="dict_button" onclick="edit_blog(${blog.id})">Edit</button>
                        <button class="dict_button" onclick="delete_blog(${blog.id})">Delete</button>
                        <hr>
                    `;

                    container.appendChild(card);
                });
            }
        } catch (error) {
            console.error(error);
            await notify({
                type: "error",
                title: "User not found",
                text: "Failed to load user"
            });
        } finally {
            setProfileLoading(false);
        }
    }

    await loadUser();

    window.delete_blog = async function (id) {
        const confirmed = await confirmDialog({
            title: "Delete the blog?",
            text: "This action cannot be undone.",
            confirmText: "Confirm",
            cancelText: "Cancel"
        });

        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/blog/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.ok) {
                await notify({
                    type: "success",
                    title: "Success!",
                    text: "Blog deleted successfully"
                });
                window.location.reload();
            } else {
                await notify({
                    type: "error",
                    title: "Request failed",
                    text: "Failed to delete the blog."
                });
            }
        } catch (error) {
            console.error(error);
            await notify({
                type: "error",
                title: "Request failed",
                text: "Failed to delete the blog."
            });
        }
    };

    window.edit_blog = async function (id) {
        window.location.href = `edit-blog/${id}`;
    };
});