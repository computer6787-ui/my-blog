import { API_URL, ROUTES, showLoading, hideLoading, notify, confirmDialog } from "./config.js?v=20260818";
import { setupMentionAutocomplete } from "./mention-autocomplete.js?v=20260909";

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

// Theme-to-prompt descriptors for rich AI cover generation
const THEME_PROMPT_DESCRIPTORS = {
    tech: "futuristic technology, digital circuits, glowing code",
    life: "serene natural landscape, golden hour, peaceful scenery",
    creative: "abstract art, vibrant colors, flowing shapes",
    ideas: "inspiring light rays, cosmic vision, abstract concept",
    insights: "wisdom, open book, luminous knowledge, zen calm",
    thoughts: "reflective mood, misty atmosphere, contemplation",
    design: "modern architecture, clean geometric shapes, minimalist aesthetic",
    story: "epic journey, winding road, adventurous horizon",
    default: "beautiful aesthetic landscape, elegant composition"
};

// Deterministic string hash (cyr-like, no external deps) → 32-bit positive int
function hashString(str = "") {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Simple stopword list so we extract meaningful content keywords, not filler words
const STOPWORDS = new Set([
    "the", "and", "that", "for", "are", "was", "with", "this", "have", "from",
    "not", "but", "they", "you", "his", "her", "she", "will", "would", "there",
    "their", "what", "about", "which", "when", "who", "your", "more", "been",
    "were", "can", "out", "just", "than", "then", "them", "some", "into", "only",
    "over", "also", "after", "where", "how", "our", "because", "very", "really",
    "just", "like", "know", "get", "got", "one", "two", "many", "much", "every",
    "still", "even", "again", "its", "it's", "i'm", "i've", "isn't", "aren't"
]);

// Extract the most descriptive, content-relevant keywords from title + body so
// the AI actually "reads" the story rather than serving a generic illustration.
function extractContentKeywords(title, body, max = 6) {
    const rawText = `${title || ""} ${body || ""}`;
    // Strip HTML tags and normalize
    const plainText = rawText
        .replace(/<[^>]*>/g, " ")
        .replace(/[^a-zA-Z0-9\s'-]/g, " ")
        .toLowerCase();

    const wordCount = new Map();
    const words = plainText.match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
    for (const w of words) {
        if (STOPWORDS.has(w)) continue;
        wordCount.set(w, (wordCount.get(w) || 0) + 1);
    }

    // Sort by frequency, tie-break by length (longer = more descriptive)
    const sorted = [...wordCount.entries()]
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
        .map(([w]) => w);

    return sorted.slice(0, max);
}

// Generate smart cover image using Pollination AI (free, no API key required)
// It "reads" the blog post by extracting content keywords from the title/body
// and feeds them to Pollination so the cover reflects the actual story. If the
// user provides a custom prompt via the UI, that prompt is used directly (and
// also becomes the deterministic seed source). By default the seed is
// deterministic — identical content + prompt always yields the same cover.
// Pass useRandomSeed=true (e.g. when the user clicks "Surprise Image") to get
// a fresh, different image on every click.
function generateSmartCoverImage(title, body, customPrompt, useRandomSeed) {
    const contentKeywords = extractContentKeywords(title, body);
    const keywordsStr = contentKeywords.length
        ? contentKeywords.join(", ")
        : "beautiful aesthetic landscape";

    // Build a concise but descriptive prompt for AI image generation
    const cleanTitle = (title || "beautiful cover").replace(/[{}()]/g, "").slice(0, 60);

    // If user supplied a custom prompt, it fully drives the generation;
    // otherwise craft a prompt that reads the story's content keywords.
    const prompt = customPrompt
        ? customPrompt.slice(0, 300)
        : `digital art illustration for an article titled "${cleanTitle}": ${keywordsStr}, vibrant colors, cinematic lighting, high quality, 4k, no text`;

    // Deterministic seed by default (same content => same cover). When the user
    // explicitly requests regeneration (Surprise button), use a fresh random
    // seed so each click produces a different image.
    const seed = useRandomSeed
        ? Math.floor(Math.random() * 2147483647)
        : hashString(customPrompt ? customPrompt : `${cleanTitle} ${keywordsStr}`);

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=630&seed=${seed}&nologo=true`;

    return { url, query: prompt, theme: detectTheme(title, body) };
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
    const aiCoverPrompt = document.getElementById("ai_cover_prompt");
    const previewPlaceholder = document.getElementById("image_preview_placeholder");
    const previewImgWrap = document.getElementById("image_preview_img_wrap");
    const previewImg = document.getElementById("preview_img");
    const editorModal = document.getElementById("image_editor_modal");
    const cropStage = document.getElementById("crop_stage");
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

    setupMentionAutocomplete(bodyInput);

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

    function clampCropValue(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function attachCropDragAndZoomHandlers() {
        if (!cropStage || !cropZoom || !cropX || !cropY) return;

        const dragState = { pointerId: null, startX: 0, startY: 0, originX: 50, originY: 50 };

        const setCropFromPointer = (clientX, clientY) => {
            const dx = clientX - dragState.startX;
            const dy = clientY - dragState.startY;
            const nextX = clampCropValue(dragState.originX + (dx / cropStage.clientWidth) * 100, 0, 100);
            const nextY = clampCropValue(dragState.originY + (dy / cropStage.clientHeight) * 100, 0, 100);
            cropX.value = String(nextX);
            cropY.value = String(nextY);
            updateCropPreview();
        };

        cropStage.addEventListener("pointerdown", (event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            dragState.pointerId = event.pointerId;
            dragState.startX = event.clientX;
            dragState.startY = event.clientY;
            dragState.originX = Number(cropX.value);
            dragState.originY = Number(cropY.value);
            cropStage.setPointerCapture(event.pointerId);
            cropStage.classList.add("is-dragging");
        });

        cropStage.addEventListener("pointermove", (event) => {
            if (dragState.pointerId !== event.pointerId) return;
            setCropFromPointer(event.clientX, event.clientY);
        });

        const endDrag = (event) => {
            if (dragState.pointerId !== null && event.pointerId === dragState.pointerId) {
                dragState.pointerId = null;
                cropStage.classList.remove("is-dragging");
            }
        };

        cropStage.addEventListener("pointerup", endDrag);
        cropStage.addEventListener("pointercancel", endDrag);
        cropStage.addEventListener("pointerleave", (event) => {
            if (dragState.pointerId !== null && event.pointerId === dragState.pointerId) {
                endDrag(event);
            }
        });

        cropStage.addEventListener("wheel", (event) => {
            event.preventDefault();
            const currentZoom = Number(cropZoom.value);
            const delta = event.deltaY < 0 ? 0.1 : -0.1;
            const nextZoom = clampCropValue(currentZoom + delta, 1, 2.7);
            cropZoom.value = String(nextZoom);
            updateCropPreview();
        }, { passive: false });
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

    attachCropDragAndZoomHandlers();

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
            const customPrompt = aiCoverPrompt ? aiCoverPrompt.value.trim() : "";

            // Show generating state while Pollination AI creates the image
            const originalText = surpriseBtn.textContent;
            surpriseBtn.disabled = true;
            surpriseBtn.textContent = "🎨 Generating…";

            // useRandomSeed = true so each click gives a NEW different image
            const smartCover = generateSmartCoverImage(title || "beautiful", body || "", customPrompt || undefined, true);
            imageInput.value = smartCover.url;
            updateImagePreview(smartCover.url);
            if (adjustBtn) adjustBtn.classList.add("hidden");

            // Reset button once the image loads or fails (once: auto-cleanup)
            const resetBtn = () => {
                surpriseBtn.disabled = false;
                surpriseBtn.textContent = originalText;
            };
            previewImg.addEventListener("load", resetBtn, { once: true });
            previewImg.addEventListener("error", resetBtn, { once: true });
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
        const newBody = bodyInput.value;
        let newImageUrl = imageInput ? imageInput.value.trim() : null;
        const newCategory = categoryInput ? categoryInput.value.trim() : null;

        // Auto-generate a deterministic AI cover when no image is present
        // The AI reads the blog content (or honors a user-supplied prompt).
        if (!newImageUrl) {
            const customPrompt = aiCoverPrompt ? aiCoverPrompt.value.trim() : "";
            const autoCover = generateSmartCoverImage(newTitle, newBody, customPrompt || undefined);
            newImageUrl = autoCover.url;
            if (imageInput) {
                imageInput.value = newImageUrl;
                updateImagePreview(newImageUrl);
            }
        }

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



