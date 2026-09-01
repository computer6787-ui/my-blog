import { API_URL, ROUTES, notify, confirmDialog } from "./config.js?v=20260818";

// Global functions for inline onclick handlers - must be defined before DOMContentLoaded
window.edit_blog = function (id) {
    window.location.href = `/edit-blog/${id}`;
};

window.delete_blog = function (id) {
    window.location.href = `/delete-blog/${id}`;
};


document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("token");
    const nameEl = document.getElementById("name");
    const emailEl = document.getElementById("email");
    const nameInput = document.getElementById("name-input");
    const toggleProfileBtn = document.getElementById("toggle-profile-edit");
    const cancelProfileBtn = document.getElementById("cancel-profile-edit");
    const nameMessage = document.getElementById("name-message");
    const profileLoading = document.getElementById("profile-loading");
    const container = document.getElementById("published-blogs");
    const bioEl = document.getElementById("bio");
    const bioInput = document.getElementById("bio-input");
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
    const locationInput = document.getElementById("location-input");
    const hobbyInput = document.getElementById("hobby-input");
    const occupationInput = document.getElementById("occupation-input");
    const educationInput = document.getElementById("education-input");
    const facebookInput = document.getElementById("facebook-input");
    const instagramInput = document.getElementById("instagram-input");
    const profilePicInput = document.getElementById("profile-picture-input");
    const profileDeviceImage = document.getElementById("profile-device-image");
    const uploadProfileBtn = document.getElementById("btn-upload-profile");
    const adjustProfileBtn = document.getElementById("btn-adjust-profile");
    const clearProfileBtn = document.getElementById("btn-clear-profile");
    const profileEditorModal = document.getElementById("profile_image_editor_modal");
    const profileCropStage = document.getElementById("profile_crop_stage");
    const profileCropImg = document.getElementById("profile_crop_image");
    const profileCropZoom = document.getElementById("profile_crop_zoom");
    const profileCropX = document.getElementById("profile_crop_x");
    const profileCropY = document.getElementById("profile_crop_y");
    const profileZoomValue = document.getElementById("profile_zoom_value");
    const closeProfileCropEditor = document.getElementById("close_profile_crop_editor");
    const cancelProfileCropEditor = document.getElementById("cancel_profile_crop_editor");
    const applyProfileCropEditor = document.getElementById("apply_profile_crop_editor");

    let originalName = "";
    let originalBio = "";
    let originalLocation = "";
    let originalHobby = "";
    let originalOccupation = "";
    let originalEducation = "";
    let originalFacebook = "";
    let originalInstagram = "";
    let originalProfilePicture = "";
    let pendingProfileImageSource = "";

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

    function isProfileEditorOpen() {
        if (!nameInput || !bioInput || !profilePicInput || !locationInput || !hobbyInput || !occupationInput || !educationInput || !facebookInput || !instagramInput) return false;
        return [nameInput, bioInput, profilePicInput, locationInput, hobbyInput, occupationInput, educationInput, facebookInput, instagramInput].some((input) => !input.classList.contains("hidden"));
    }

    function updateProfileButtonState() {
        if (!toggleProfileBtn) return;
        const isEditing = isProfileEditorOpen();
        toggleProfileBtn.textContent = isEditing ? "✓ Save Profile" : "✎ Edit Profile";
        toggleProfileBtn.setAttribute("aria-label", isEditing ? "Save profile" : "Edit profile");
        toggleProfileBtn.classList.toggle("publish-button", isEditing);
        const readonlyMeta = document.getElementById("profile-readonly-meta");
        if (readonlyMeta) readonlyMeta.classList.toggle("hidden", isEditing);
        if (cancelProfileBtn) cancelProfileBtn.classList.toggle("hidden", !isEditing);
    }

    function updateProfileUploadButtons() {
        const hasEditorVisible = !profilePicInput.classList.contains("hidden");
        if (uploadProfileBtn) uploadProfileBtn.classList.toggle("hidden", !hasEditorVisible);
        if (adjustProfileBtn) adjustProfileBtn.classList.toggle("hidden", !hasEditorVisible || !profilePicInput.value.trim());
        if (clearProfileBtn) clearProfileBtn.classList.toggle("hidden", !hasEditorVisible || !profilePicInput.value.trim());
    }

    function createWebPDataUrl(file, quality = 0.72, maxWidth = 1600, maxHeight = 1200) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
                    const width = Math.max(1, Math.round(image.width * ratio));
                    const height = Math.max(1, Math.round(image.height * ratio));
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(image, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/webp", quality));
                    URL.revokeObjectURL(url);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Unable to read image."));
            };
            image.src = url;
        });
    }

    function openProfileCropEditor(source) {
        if (!profileEditorModal || !profileCropImg || !profileCropZoom || !profileCropX || !profileCropY || !profileZoomValue) return;
        pendingProfileImageSource = source || pendingProfileImageSource || profilePicInput.value.trim();
        if (!pendingProfileImageSource) return;
        profileCropImg.src = pendingProfileImageSource;
        profileCropImg.onload = () => {
            profileCropZoom.value = 1;
            profileCropX.value = 50;
            profileCropY.value = 50;
            updateProfileCropPreview();
            profileEditorModal.classList.remove("hidden");
            profileEditorModal.setAttribute("aria-hidden", "false");
        };
    }

    function closeProfileCropEditorDialog() {
        if (!profileEditorModal) return;
        profileEditorModal.classList.add("hidden");
        profileEditorModal.setAttribute("aria-hidden", "true");
    }

    function updateProfileCropPreview() {
        if (!profileCropImg || !profileCropZoom || !profileCropX || !profileCropY || !profileZoomValue) return;
        const zoom = Number(profileCropZoom.value);
        const xPercent = Number(profileCropX.value) / 100;
        const yPercent = Number(profileCropY.value) / 100;
        const maxShift = Math.max(0, (zoom - 1) * 60);
        const offsetX = (xPercent - 0.5) * 2 * maxShift;
        const offsetY = (yPercent - 0.5) * 2 * maxShift;
        profileCropImg.style.transform = `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`;
        profileZoomValue.textContent = `${Math.round(zoom * 100)}%`;
    }

    function clampProfileCropValue(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function attachProfileCropDragAndZoomHandlers() {
        if (!profileCropStage || !profileCropZoom || !profileCropX || !profileCropY) return;

        const dragState = { pointerId: null, startX: 0, startY: 0, originX: 50, originY: 50 };

        const setCropFromPointer = (clientX, clientY) => {
            const dx = clientX - dragState.startX;
            const dy = clientY - dragState.startY;
            const nextX = clampProfileCropValue(dragState.originX + (dx / profileCropStage.clientWidth) * 100, 0, 100);
            const nextY = clampProfileCropValue(dragState.originY + (dy / profileCropStage.clientHeight) * 100, 0, 100);
            profileCropX.value = String(nextX);
            profileCropY.value = String(nextY);
            updateProfileCropPreview();
        };

        profileCropStage.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            dragState.pointerId = event.pointerId;
            dragState.startX = event.clientX;
            dragState.startY = event.clientY;
            dragState.originX = Number(profileCropX.value);
            dragState.originY = Number(profileCropY.value);
            profileCropStage.setPointerCapture(event.pointerId);
            profileCropStage.classList.add("is-dragging");
        });

        profileCropStage.addEventListener("pointermove", (event) => {
            if (dragState.pointerId !== event.pointerId) return;
            setCropFromPointer(event.clientX, event.clientY);
        });

        const endDrag = (event) => {
            if (dragState.pointerId !== null && event.pointerId === dragState.pointerId) {
                dragState.pointerId = null;
                profileCropStage.classList.remove("is-dragging");
            }
        };

        profileCropStage.addEventListener("pointerup", endDrag);
        profileCropStage.addEventListener("pointercancel", endDrag);
        profileCropStage.addEventListener("pointerleave", (event) => {
            if (dragState.pointerId !== null && event.pointerId === dragState.pointerId) {
                endDrag(event);
            }
        });

        profileCropStage.addEventListener("wheel", (event) => {
            event.preventDefault();
            const currentZoom = Number(profileCropZoom.value);
            const delta = event.deltaY < 0 ? 0.1 : -0.1;
            const nextZoom = clampProfileCropValue(currentZoom + delta, 1, 2.7);
            profileCropZoom.value = String(nextZoom);
            updateProfileCropPreview();
        }, { passive: false });
    }

    async function processProfileImage(file) {
        if (!file || !file.type.startsWith("image/")) {
            await notify({ type: "warning", title: "Invalid file", text: "Please choose a valid image file." });
            return;
        }

        try {
            const webpDataUrl = await createWebPDataUrl(file, 0.72, 1600, 1200);
            pendingProfileImageSource = webpDataUrl;
            if (profilePicInput) {
                profilePicInput.value = webpDataUrl;
            }
            updateProfileUploadButtons();
            if (adjustProfileBtn) adjustProfileBtn.classList.remove("hidden");
            if (clearProfileBtn) clearProfileBtn.classList.remove("hidden");
            if (profileDeviceImage) profileDeviceImage.value = "";
        } catch (error) {
            console.error(error);
            await notify({ type: "error", title: "Image processing failed", text: "Could not read that image." });
        }
    }

    function openProfileEditor() {
        if (!bioInput || !profilePicInput || !nameInput || !nameEl || !toggleProfileBtn || !locationInput || !hobbyInput || !occupationInput || !educationInput || !facebookInput || !instagramInput) return;

        const currentBio = bioEl ? bioEl.textContent.trim() : "";
        const editGrid = document.getElementById("profile-edit-grid");
        nameInput.classList.remove("hidden");
        bioInput.classList.remove("hidden");
        profilePicInput.classList.remove("hidden");
        locationInput.classList.remove("hidden");
        hobbyInput.classList.remove("hidden");
        occupationInput.classList.remove("hidden");
        educationInput.classList.remove("hidden");
        facebookInput.classList.remove("hidden");
        instagramInput.classList.remove("hidden");
        if (editGrid) editGrid.classList.remove("hidden");
        if (uploadProfileBtn) uploadProfileBtn.classList.remove("hidden");
        if (adjustProfileBtn) adjustProfileBtn.classList.toggle("hidden", !profilePicInput.value.trim());
        if (clearProfileBtn) clearProfileBtn.classList.toggle("hidden", !profilePicInput.value.trim());
        nameEl.classList.add("hidden");
        if (bioEl) bioEl.classList.add("hidden");

        nameInput.value = originalName;
        bioInput.value = currentBio === "No bio yet. Tell the community a little about yourself." ? "" : currentBio;
        locationInput.value = originalLocation || "";
        hobbyInput.value = originalHobby || "";
        occupationInput.value = originalOccupation || "";
        educationInput.value = originalEducation || "";
        facebookInput.value = originalFacebook || "";
        instagramInput.value = originalInstagram || "";
        profilePicInput.value = originalProfilePicture || "";
        nameInput.focus();
        updateProfileButtonState();
    }

    function closeProfileEditor() {
        if (!nameInput || !nameEl || !toggleProfileBtn || !locationInput || !hobbyInput || !occupationInput || !educationInput || !facebookInput || !instagramInput) return;
        nameInput.classList.add("hidden");
        nameEl.classList.remove("hidden");
        if (bioEl) bioEl.classList.remove("hidden");
        if (bioInput) bioInput.classList.add("hidden");
        if (profilePicInput) profilePicInput.classList.add("hidden");
        locationInput.classList.add("hidden");
        hobbyInput.classList.add("hidden");
        occupationInput.classList.add("hidden");
        educationInput.classList.add("hidden");
        facebookInput.classList.add("hidden");
        instagramInput.classList.add("hidden");
        const editGrid = document.getElementById("profile-edit-grid");
        if (editGrid) editGrid.classList.add("hidden");
        if (uploadProfileBtn) uploadProfileBtn.classList.add("hidden");
        if (adjustProfileBtn) adjustProfileBtn.classList.add("hidden");
        if (clearProfileBtn) clearProfileBtn.classList.add("hidden");
        nameInput.value = "";
        bioInput.value = "";
        locationInput.value = "";
        hobbyInput.value = "";
        occupationInput.value = "";
        educationInput.value = "";
        facebookInput.value = "";
        instagramInput.value = "";
        const readonlyMeta = document.getElementById("profile-readonly-meta");
        if (readonlyMeta) readonlyMeta.classList.remove("hidden");
        profilePicInput.value = "";
        pendingProfileImageSource = "";
        updateProfileUploadButtons();
        toggleProfileBtn.textContent = "✎ Edit Profile";
        toggleProfileBtn.setAttribute("aria-label", "Edit profile");
        toggleProfileBtn.classList.remove("publish-button");
        if (cancelProfileBtn) cancelProfileBtn.classList.add("hidden");
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
                closeProfileEditor();
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
            closeProfileEditor();

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

    async function saveProfile() {
        if (!bioInput || !profilePicInput || !locationInput || !hobbyInput || !occupationInput || !educationInput || !facebookInput || !instagramInput) return;

        const nextBio = bioInput.value.trim();
        const nextLocation = locationInput.value.trim();
        const nextHobby = hobbyInput.value.trim();
        const nextOccupation = occupationInput.value.trim();
        const nextEducation = educationInput.value.trim();
        const nextFacebook = facebookInput.value.trim();
        const nextInstagram = instagramInput.value.trim();
        const nextProfilePicture = profilePicInput.value.trim();

        nameMessage.textContent = "Saving your profile...";
        nameMessage.style.color = "var(--muted)";

        try {
            const response = await fetch(`${API_URL}/user/edit_profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    bio: nextBio,
                    location: nextLocation || null,
                    hobby: nextHobby || null,
                    occupation: nextOccupation || null,
                    education: nextEducation || null,
                    facebook: nextFacebook || null,
                    instagram: nextInstagram || null,
                    profile_picture_url: nextProfilePicture || null
                })
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(result.detail || "Failed to update profile");
            }

            originalBio = nextBio;
            originalLocation = nextLocation;
            originalHobby = nextHobby;
            originalOccupation = nextOccupation;
            originalEducation = nextEducation;
            originalFacebook = nextFacebook;
            originalInstagram = nextInstagram;
            originalProfilePicture = nextProfilePicture;

            if (bioEl) {
                bioEl.textContent = nextBio || "No bio yet. Tell the community a little about yourself.";
            }

            const profileMeta = [
                { row: locationRow, value: nextLocation, text: locationText, empty: "Add your place" },
                { row: hobbyRow, value: nextHobby, text: hobbyText, empty: "Add your hobby" },
                { row: occupationRow, value: nextOccupation, text: occupationText, empty: "Add your occupation" },
                { row: educationRow, value: nextEducation, text: educationText, empty: "Add your education" },
                { row: facebookRow, value: nextFacebook, text: facebookText, empty: "Add Facebook profile" },
                { row: instagramRow, value: nextInstagram, text: instagramText, empty: "Add Instagram" }
            ];

            profileMeta.forEach(({ row, value, text, empty }) => {
                if (!row || !text) return;
                row.classList.remove("hidden");
                text.textContent = value || empty;
            });

            const avatarEl = document.getElementById("profile-avatar");
            if (avatarEl) {
                if (nextProfilePicture) {
                    avatarEl.style.backgroundImage = `url("${nextProfilePicture}")`;
                    avatarEl.style.backgroundSize = "cover";
                    avatarEl.style.backgroundPosition = "center";
                    avatarEl.textContent = "";
                } else {
                    avatarEl.style.backgroundImage = "";
                    avatarEl.style.backgroundSize = "";
                    avatarEl.style.backgroundPosition = "";
                    avatarEl.textContent = (originalName[0] || "L").toUpperCase();
                }
            }

            nameMessage.textContent = "Profile updated successfully.";
            nameMessage.style.color = "#1f9d5a";
            closeProfileEditor();

            await notify({
                type: "success",
                title: "Profile saved",
                text: "Your profile details were updated."
            });
        } catch (error) {
            console.error(error);
            nameMessage.textContent = error.message || "Could not update profile.";
            nameMessage.style.color = "#d93025";
            await notify({
                type: "error",
                title: "Profile update failed",
                text: error.message || "Could not update profile."
            });
        }
    }

    if (toggleProfileBtn) {
        toggleProfileBtn.addEventListener("click", async function () {
            const editing = isProfileEditorOpen();

            if (!editing) {
                openProfileEditor();
                return;
            }

            const hasChanges =
                (nameInput.value.trim() !== originalName) ||
                (bioInput.value.trim() !== (originalBio || "")) ||
                (locationInput.value.trim() !== (originalLocation || "")) ||
                (hobbyInput.value.trim() !== (originalHobby || "")) ||
                (occupationInput.value.trim() !== (originalOccupation || "")) ||
                (educationInput.value.trim() !== (originalEducation || "")) ||
                (facebookInput.value.trim() !== (originalFacebook || "")) ||
                (instagramInput.value.trim() !== (originalInstagram || "")) ||
                (profilePicInput.value.trim() !== (originalProfilePicture || ""));

            if (!hasChanges) {
                closeProfileEditor();
                return;
            }

            const nameValue = nameInput.value.trim();
            if (nameValue && nameValue !== originalName) {
                await saveName();
            }

            if (
                bioInput.value.trim() !== (originalBio || "") ||
                locationInput.value.trim() !== (originalLocation || "") ||
                hobbyInput.value.trim() !== (originalHobby || "") ||
                occupationInput.value.trim() !== (originalOccupation || "") ||
                educationInput.value.trim() !== (originalEducation || "") ||
                facebookInput.value.trim() !== (originalFacebook || "") ||
                instagramInput.value.trim() !== (originalInstagram || "") ||
                profilePicInput.value.trim() !== (originalProfilePicture || "")
            ) {
                await saveProfile();
            }
        });
    }

    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener("click", closeProfileEditor);
    }

    document.querySelectorAll(".profile-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            const targetId = tab.dataset.tab;
            const targetPanel = document.getElementById(targetId);
            document.querySelectorAll(".profile-tab").forEach((button) => button.classList.toggle("is-active", button === tab));
            document.querySelectorAll("#profile-panel, #blogs-panel").forEach((panel) => {
                panel.classList.toggle("hidden", panel.id !== targetId);
            });
            if (targetPanel && targetPanel.id === "blogs-panel") {
                window.scrollTo({ top: 0, behavior: "instant" });
            }
        });
    });

    if (nameInput) {
        nameInput.addEventListener("input", updateProfileButtonState);
        nameInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                saveName();
                saveProfile();
            }
        });
    }

    if (bioInput) {
        bioInput.addEventListener("keydown", function (event) {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                saveProfile();
            }
        });
    }

    if (uploadProfileBtn && profileDeviceImage) {
        uploadProfileBtn.addEventListener("click", () => profileDeviceImage.click());
        profileDeviceImage.addEventListener("change", () => {
            const file = profileDeviceImage.files && profileDeviceImage.files[0];
            if (file) {
                processProfileImage(file);
            }
        });
    }

    if (adjustProfileBtn && profilePicInput) {
        adjustProfileBtn.addEventListener("click", () => openProfileCropEditor(profilePicInput.value.trim()));
    }

    if (clearProfileBtn && profilePicInput) {
        clearProfileBtn.addEventListener("click", () => {
            profilePicInput.value = "";
            pendingProfileImageSource = "";
            updateProfileUploadButtons();
        });
    }

    if (profileCropZoom) profileCropZoom.addEventListener("input", updateProfileCropPreview);
    if (profileCropX) profileCropX.addEventListener("input", updateProfileCropPreview);
    if (profileCropY) profileCropY.addEventListener("input", updateProfileCropPreview);

    if (closeProfileCropEditor) closeProfileCropEditor.addEventListener("click", closeProfileCropEditorDialog);
    if (cancelProfileCropEditor) cancelProfileCropEditor.addEventListener("click", closeProfileCropEditorDialog);
    if (applyProfileCropEditor && profilePicInput) {
        applyProfileCropEditor.addEventListener("click", () => {
            if (!profileCropImg || !profileCropImg.src) return;
            profilePicInput.value = profileCropImg.src;
            pendingProfileImageSource = profileCropImg.src;
            updateProfileUploadButtons();
            closeProfileCropEditorDialog();
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
            originalBio = user.bio || "";
            originalLocation = user.location || "";
            originalHobby = user.hobby || "";
            originalOccupation = user.occupation || "";
            originalEducation = user.education || "";
            originalFacebook = user.facebook || "";
            originalInstagram = user.instagram || "";
            originalProfilePicture = user.profile_picture_url || "";

            if (nameEl) nameEl.textContent = originalName || "Author";
            if (emailEl) emailEl.textContent = user.email || "No email";
            if (bioEl) bioEl.textContent = originalBio || "No bio yet. Tell the community a little about yourself.";

            const metaItems = [
                { row: locationRow, value: originalLocation, text: locationText, empty: "Add your place" },
                { row: hobbyRow, value: originalHobby, text: hobbyText, empty: "Add your hobby" },
                { row: occupationRow, value: originalOccupation, text: occupationText, empty: "Add your occupation" },
                { row: educationRow, value: originalEducation, text: educationText, empty: "Add your education" },
                { row: facebookRow, value: originalFacebook, text: facebookText, empty: "Add Facebook profile" },
                { row: instagramRow, value: originalInstagram, text: instagramText, empty: "Add Instagram" }
            ];

            metaItems.forEach(({ row, value, text, empty }) => {
                if (!row || !text) return;
                row.classList.remove("hidden");
                text.textContent = value || empty;
            });

            const avatarEl = document.getElementById("profile-avatar");
            if (avatarEl) {
                if (originalProfilePicture) {
                    avatarEl.style.backgroundImage = `url("${originalProfilePicture}")`;
                    avatarEl.style.backgroundSize = "cover";
                    avatarEl.style.backgroundPosition = "center";
                    avatarEl.textContent = "";
                } else {
                    avatarEl.style.backgroundImage = "";
                    avatarEl.style.backgroundSize = "";
                    avatarEl.style.backgroundPosition = "";
                    avatarEl.textContent = (originalName[0] || "L").toUpperCase();
                }
            }

            const storyCountBadge = document.getElementById("story-count-badge");
            if (storyCountBadge) {
                storyCountBadge.textContent = `${blogs.length} ${blogs.length === 1 ? "story" : "stories"}`;
            }

            if (nameInput) nameInput.value = "";
            if (locationInput) locationInput.value = originalLocation || "";
            if (hobbyInput) hobbyInput.value = originalHobby || "";
            if (occupationInput) occupationInput.value = originalOccupation || "";
            if (educationInput) educationInput.value = originalEducation || "";
            if (facebookInput) facebookInput.value = originalFacebook || "";
            if (instagramInput) instagramInput.value = originalInstagram || "";
            closeProfileEditor();

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
                    const snippetText = ((blog.body || "").replace(/\s+/g, " ").trim());
                    const snippet = snippetText.length > 90 ? snippetText.slice(0, 90).trimEnd() + "..." : snippetText;

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

    // Call profile crop handlers
    attachProfileCropDragAndZoomHandlers();
});

