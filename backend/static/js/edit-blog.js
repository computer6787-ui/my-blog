import { API_URL, ROUTES, showLoading, hideLoading, notify, confirmDialog } from "./config.js?v=20260818";

const id = window.location.pathname.split("/").pop();

// Theme to image query mappings for intelligent cover selection
const THEME_IMAGE_QUERIES = {
    tech: ["technology", "code", "computer", "digital", "cyber", "server", "data", "programming"],
    life: ["nature", "lifestyle", "peaceful", "travel", "people", "mountain", "ocean", "sunset"],
    creative: ["art", "creative", "abstract", "colorful", "design", "painting", "music", "artistic"],
    ideas: ["innovation", "rocket", "space", "dream", "vision", "idea", "future", "light"],
    insights: ["wisdom", "knowledge", "book", "philosophy", "meditation", "clarity", "zen"],
    thoughts: ["mind", "reflection", "silhouette", "fog", "mystery", "wonder", "calm"],
    design: ["architecture", "interior", "minimalist", "geometric", "modern", "typography"],
    story: ["adventure", "journey", "road", "path", "exploration", "travel", "horizon"],
    default: ["beautiful", "aesthetic", "landscape", "nature", "minimal", "elegant"]
};

// Content keywords for theme detection
const CONTENT_KEYWORDS = {
    tech: ["code", "programming", "software", "data", "algorithm", "web", "app", "developer", "python", "javascript", "database", "server", "api", "tech", "computer", "digital", "technology", "ai", "cyber"],
    life: ["life", "people", "human", "family", "friend", "love", "health", "happiness", "experience", "journey", "growth", "story", "moment", "memory", "nature", "travel", "adventure", "peace"],
    creative: ["art", "design", "creative", "music", "paint", "draw", "beautiful", "aesthetic", "craft", "create", "visual", "color", "inspire", "artistic"],
    ideas: ["idea", "think", "thought", "concept", "philosophy", "perspective", "vision", "dream", "possibility", "potential", "innovation", "future"],
    insights: ["insight", "learn", "knowledge", "wisdom", "understand", "realize", "discover", "lesson", "truth", "meaning", "purpose", "deep", "teach"],
    thoughts: ["think", "thought", "mind", "feel", "feeling", "emotion", "wonder", "question", "curious", "reflect", "ponder", "soul", "heart"],
    design: ["design", "ui", "ux", "interface", "layout", "visual", "user", "experience", "build", "pattern", "architecture", "minimal"]
};

// Detect theme from content
function detectTheme(title, body) {
    const text = `${title} ${body}`.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];
    
    const scores = {};
    for (const [theme, keywords] of Object.entries(CONTENT_KEYWORDS)) {
        scores[theme] = keywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = text.match(regex) || [];
            return count + matches.length;
        }, 0);
    }
    
    let bestTheme = 'default';
    let bestScore = 0;
    for (const [theme, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestTheme = theme;
        }
    }
    
    if (bestScore === 0) {
        if (words.length > 500) bestTheme = 'insights';
        else if (words.length > 200) bestTheme = 'thoughts';
        else bestTheme = 'creative';
    }
    
    return bestTheme;
}

// Generate smart cover image based on content
function generateSmartCoverImage(title, body) {
    const theme = detectTheme(title, body);
    const queries = THEME_IMAGE_QUERIES[theme] || THEME_IMAGE_QUERIES.default;

    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = (hash << 5) - hash + title.charCodeAt(i);
        hash |= 0;
    }

    const queryIndex = Math.abs(hash) % queries.length;
    const selectedQuery = queries[queryIndex];

    // Use a different random seed each time so the same post can regenerate to a new image.
    const imageId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.abs(hash)}`;
    const picsumUrl = `https://picsum.photos/seed/${encodeURIComponent(imageId)}/800/500`;

    return { url: picsumUrl, query: selectedQuery, theme: theme };
}

document.addEventListener("DOMContentLoaded", function () {
    const titleInput = document.getElementById("title");
    const bodyInput = document.getElementById("body");
    const imageInput = document.getElementById("image_url");
    const deviceImageInput = document.getElementById("device_image");
    const categoryInput = document.getElementById("category");
    const editForm = document.getElementById("edit-form");
    const uploadBtn = document.getElementById("btn-upload-img");
    const adjustBtn = document.getElementById("btn-adjust-img");
    const surpriseBtn = document.getElementById("btn-surprise-img");
    const clearImgBtn = document.getElementById("btn-clear-img");
    const previewPlaceholder = document.getElementById("image_preview_placeholder");
    const previewImgWrap = document.getElementById("image_preview_img_wrap");
    const previewImg = document.getElementById("preview_img");
    const editorModal = document.getElementById("image_editor_modal");
    const cropImg = document.getElementById("crop_image");
    const cropZoom = document.getElementById("crop_zoom");
    const cropX = document.getElementById("crop_x");
    const cropY = document.getElementById("crop_y");
    const zoomValue = document.getElementById("zoom_value");
    const closeCropEditor = document.getElementById("close_crop_editor");
    const cancelCropEditor = document.getElementById("cancel_crop_editor");
    const applyCropEditor = document.getElementById("apply_crop_editor");
    const wordCountEl = document.getElementById("word-count");
    const readingTimeEl = document.getElementById("reading-time");

    if (!titleInput || !bodyInput || !editForm) return;

    function updateStats() {
        const text = bodyInput.value.trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        const minutes = Math.max(1, Math.ceil(words / 180));
        if (wordCountEl) wordCountEl.textContent = `${words} ${words === 1 ? "word" : "words"}`;
        if (readingTimeEl) readingTimeEl.textContent = `~${minutes} min read`;
    }

    function autoResize() {
        bodyInput.style.height = "auto";
        bodyInput.style.height = `${Math.max(bodyInput.scrollHeight, 240)}px`;
    }

    function updateImagePreview(url) {
        const cleanUrl = (url || "").trim();
        if (cleanUrl) {
            previewImg.src = cleanUrl;
            previewImg.onload = () => {
                if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
                if (previewImgWrap) previewImgWrap.classList.remove("hidden");
                if (clearImgBtn) clearImgBtn.classList.remove("hidden");
            };
            previewImg.onerror = () => {
                if (previewPlaceholder) previewPlaceholder.classList.remove("hidden");
                if (previewImgWrap) previewImgWrap.classList.add("hidden");
            };
        } else {
            previewImg.src = "";
            if (previewPlaceholder) previewPlaceholder.classList.remove("hidden");
            if (previewImgWrap) previewImgWrap.classList.add("hidden");
            if (clearImgBtn) clearImgBtn.classList.add("hidden");
        }
    }

    let pendingImageSource = "";

    function openCropEditor(source) {
        if (!editorModal || !cropImg || !cropZoom || !cropX || !cropY) return;
        pendingImageSource = source || pendingImageSource;
        cropImg.src = pendingImageSource;
        cropImg.onload = () => {
            cropZoom.value = 1;
            cropX.value = 50;
            cropY.value = 50;
            updateCropPreview();
            editorModal.classList.remove("hidden");
            editorModal.setAttribute("aria-hidden", "false");
        };
    }

    function closeCropEditorDialog() {
        if (!editorModal) return;
        editorModal.classList.add("hidden");
        editorModal.setAttribute("aria-hidden", "true");
    }

    function updateCropPreview() {
        if (!cropImg || !cropZoom || !cropX || !cropY || !zoomValue) return;

        const zoom = Number(cropZoom.value);
        const xPercent = Number(cropX.value) / 100;
        const yPercent = Number(cropY.value) / 100;
        const maxShift = Math.max(0, (zoom - 1) * 60);
        const offsetX = (xPercent - 0.5) * 2 * maxShift;
        const offsetY = (yPercent - 0.5) * 2 * maxShift;

        cropImg.style.transform = `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`;
        zoomValue.textContent = `${Math.round(zoom * 100)}%`;
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
                    const webpDataUrl = canvas.toDataURL("image/webp", quality);
                    URL.revokeObjectURL(url);
                    resolve(webpDataUrl);
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

    async function processSelectedImage(file) {
        if (!file || !file.type.startsWith("image/")) {
            notify({ type: "warning", title: "Invalid file", text: "Please choose an image file." });
            return;
        }

        try {
            const webpDataUrl = await createWebPDataUrl(file, 0.72, 1600, 1200);
            pendingImageSource = webpDataUrl;
            imageInput.value = webpDataUrl;
            updateImagePreview(webpDataUrl);
            if (adjustBtn) adjustBtn.classList.remove("hidden");
            openCropEditor(webpDataUrl);
        } catch (error) {
            console.error(error);
            notify({ type: "error", title: "Image Error", text: "This image could not be processed. Please try another one." });
        }
    }

    function resetImageState() {
        pendingImageSource = "";
        imageInput.value = "";
        if (deviceImageInput) deviceImageInput.value = "";
        if (adjustBtn) adjustBtn.classList.add("hidden");
        updateImagePreview("");
    }

    if (cropZoom) cropZoom.addEventListener("input", updateCropPreview);
    if (cropX) cropX.addEventListener("input", updateCropPreview);
    if (cropY) cropY.addEventListener("input", updateCropPreview);
    if (closeCropEditor) closeCropEditor.addEventListener("click", closeCropEditorDialog);
    if (cancelCropEditor) cancelCropEditor.addEventListener("click", closeCropEditorDialog);
    if (applyCropEditor) {
        applyCropEditor.addEventListener("click", async () => {
            if (!pendingImageSource) {
                closeCropEditorDialog();
                return;
            }

            try {
                const sourceImage = new Image();
                sourceImage.onload = async () => {
                    const cropCanvas = document.createElement("canvas");
                    const finalWidth = 1200;
                    const finalHeight = 675;
                    cropCanvas.width = finalWidth;
                    cropCanvas.height = finalHeight;
                    const context = cropCanvas.getContext("2d");
                    const zoom = Number(cropZoom.value);
                    const centerX = Number(cropX.value) / 100;
                    const centerY = Number(cropY.value) / 100;

                    const cropWidth = sourceImage.width / zoom;
                    const cropHeight = sourceImage.height / zoom;
                    const sourceX = Math.min(
                        Math.max((sourceImage.width - cropWidth) * centerX, 0),
                        Math.max(sourceImage.width - cropWidth, 0)
                    );
                    const sourceY = Math.min(
                        Math.max((sourceImage.height - cropHeight) * centerY, 0),
                        Math.max(sourceImage.height - cropHeight, 0)
                    );

                    context.clearRect(0, 0, finalWidth, finalHeight);
                    context.fillStyle = "#1f1b2e";
                    context.fillRect(0, 0, finalWidth, finalHeight);
                    context.drawImage(
                        sourceImage,
                        sourceX,
                        sourceY,
                        cropWidth,
                        cropHeight,
                        0,
                        0,
                        finalWidth,
                        finalHeight
                    );

                    const croppedWebp = cropCanvas.toDataURL("image/webp", 0.74);
                    imageInput.value = croppedWebp;
                    updateImagePreview(croppedWebp);
                    closeCropEditorDialog();
                };
                sourceImage.src = pendingImageSource;
            } catch (error) {
                console.error(error);
                notify({ type: "error", title: "Crop Error", text: "The crop could not be applied. Please try again." });
            }
        });
    }

    if (imageInput) {
        imageInput.addEventListener("input", (e) => updateImagePreview(e.target.value));
    }

    if (uploadBtn && deviceImageInput && imageInput) {
        uploadBtn.addEventListener("click", () => deviceImageInput.click());

        deviceImageInput.addEventListener("change", () => {
            const file = deviceImageInput.files && deviceImageInput.files[0];
            if (!file) return;
            processSelectedImage(file);
        });
    }

    if (adjustBtn) {
        adjustBtn.addEventListener("click", () => openCropEditor(pendingImageSource));
    }

    if (surpriseBtn && imageInput) {
        surpriseBtn.addEventListener("click", () => {
            const title = titleInput.value.trim();
            const body = bodyInput.value.trim();
            const smartCover = generateSmartCoverImage(title || "beautiful", body || "");
            imageInput.value = smartCover.url;
            updateImagePreview(smartCover.url);
            if (adjustBtn) adjustBtn.classList.add("hidden");
        });
    }

    if (clearImgBtn && imageInput) {
        clearImgBtn.addEventListener("click", () => {
            resetImageState();
        });
    }

    function setUploadedPreviewFromUrl(url) {
        if (!url) {
            if (adjustBtn) adjustBtn.classList.add("hidden");
            return;
        }
        pendingImageSource = url;
        updateImagePreview(url);
        if (adjustBtn) adjustBtn.classList.remove("hidden");
    }

    bodyInput.addEventListener("input", () => {
        autoResize();
        updateStats();
    });

    async function loadBlog() {
        const token = localStorage.getItem("token");
        showLoading("Loading story for editing...");

        try {
            const response = await fetch(`${API_URL}/blog/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) {
                hideLoading();
                await notify({ type: "error", title: "Story Not Found", text: "This story could not be loaded." });
                window.location.href = ROUTES.PROFILE;
                return;
            }

            const blog = await response.json();
            titleInput.value = blog.title || "";
            bodyInput.value = blog.body || "";
            if (imageInput) {
                imageInput.value = blog.image_url || "";
                updateImagePreview(blog.image_url || "");
                setUploadedPreviewFromUrl(blog.image_url || "");
            }
            if (categoryInput) {
                categoryInput.value = blog.category || "";
            }
            autoResize();
            updateStats();
        } catch (error) {
            console.error(error);
            notify({ type: "error", title: "Connection Error", text: "Could not load the story right now." });
        } finally {
            hideLoading();
        }
    }

    async function editBlog() {
        const token = localStorage.getItem("token");
        const newTitle = titleInput.value.trim();
        const newBody = bodyInput.value.trim();
        const newImageUrl = imageInput ? imageInput.value.trim() : null;
        const newCategory = categoryInput ? categoryInput.value.trim() : null;

        showLoading("Saving changes...");

        try {
            const response = await fetch(`${API_URL}/blog/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: newTitle,
                    body: newBody,
                    image_url: newImageUrl || null,
                    category: newCategory || null
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    await notify({ type: "error", title: "Access Denied", text: error.detail || "No permission to edit." });
                } else if (response.status === 401) {
                    await notify({ type: "warning", title: "Login Required", text: "Please log in to edit." });
                    window.location.href = ROUTES.LOGIN;
                } else {
                    await notify({ type: "error", title: "Update Failed", text: error.detail || "Unable to save changes." });
                }
                return false;
            }
            return true;
        } finally {
            hideLoading();
        }
    }

    loadBlog();

    editForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const confirmed = await confirmDialog({
            title: "Save Changes",
            text: "Are you sure you want to update this story?",
            confirmText: "Save",
            cancelText: "Cancel"
        });

        if (!confirmed) return;

        const success = await editBlog();
        if (!success) return;

        await notify({
            type: "success",
            title: "Story Updated!",
            text: "Your changes have been saved successfully."
        });

        window.location.href = ROUTES.PROFILE;
    });
});



