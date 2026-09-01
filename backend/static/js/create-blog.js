import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";

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

    // Use a random seed so the same blog can regenerate into a different image each click.
    const imageId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.abs(hash)}`;
    const picsumUrl = `https://picsum.photos/seed/${encodeURIComponent(imageId)}/800/500`;

    return { url: picsumUrl, query: selectedQuery, theme: theme };
}

// Fallback images for each theme
const THEME_FALLBACKS = {
    tech: ["https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80"],
    life: ["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80"],
    creative: ["https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80"],
    ideas: ["https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1200&q=80"],
    insights: ["https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=80"],
    thoughts: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80"],
    design: ["https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1200&q=80"],
    story: ["https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80"],
    default: ["https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=80", "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80"]
};

document.addEventListener("DOMContentLoaded", function () {
    const titleInput = document.getElementById("title");
    const bodyInput = document.getElementById("body");
    const imageInput = document.getElementById("image_url");
    const deviceImageInput = document.getElementById("device_image");
    const categoryInput = document.getElementById("category");
    const blogForm = document.getElementById("blog_form");
    const uploadBtn = document.getElementById("btn-upload-img");
    const surpriseBtn = document.getElementById("btn-surprise-img");
    const clearImgBtn = document.getElementById("btn-clear-img");
    const previewPlaceholder = document.getElementById("image_preview_placeholder");
    const previewImgWrap = document.getElementById("image_preview_img_wrap");
    const previewImg = document.getElementById("preview_img");
    const wordCountEl = document.getElementById("word-count");
    const readingTimeEl = document.getElementById("reading-time");

    if (!titleInput || !bodyInput || !blogForm) return;

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

    bodyInput.addEventListener("input", () => {
        autoResize();
        updateStats();
    });

    if (imageInput) {
        imageInput.addEventListener("input", (e) => updateImagePreview(e.target.value));
    }

    if (uploadBtn && deviceImageInput && imageInput) {
        uploadBtn.addEventListener("click", () => deviceImageInput.click());

        deviceImageInput.addEventListener("change", () => {
            const file = deviceImageInput.files && deviceImageInput.files[0];
            if (!file) return;

            if (!file.type.startsWith("image/")) {
                notify({ type: "warning", title: "Invalid file", text: "Please choose an image file." });
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                imageInput.value = dataUrl;
                updateImagePreview(dataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    if (surpriseBtn && imageInput) {
        surpriseBtn.addEventListener("click", () => {
            const title = titleInput.value.trim();
            const body = bodyInput.value.trim();
            const smartCover = generateSmartCoverImage(title || "beautiful", body || "");
            imageInput.value = smartCover.url;
            updateImagePreview(smartCover.url);
        });
    }

    if (clearImgBtn && imageInput) {
        clearImgBtn.addEventListener("click", () => {
            imageInput.value = "";
            if (deviceImageInput) deviceImageInput.value = "";
            updateImagePreview("");
        });
    }

    autoResize();
    updateStats();

    blogForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const blogTitle = titleInput.value.trim();
        const blogBody = bodyInput.value.trim();
        const blogImageUrl = imageInput ? imageInput.value.trim() : null;
        const blogCategory = categoryInput ? categoryInput.value.trim() : null;
        const token = localStorage.getItem("token");

        if (!blogTitle || !blogBody) {
            notify({ type: "warning", title: "Missing Fields", text: "Please provide a title and story content." });
            return;
        }

        showLoading("Publishing your story...");

        try {
            const response = await fetch(`${API_URL}/blog`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: blogTitle,
                    body: blogBody,
                    image_url: blogImageUrl || null,
                    category: blogCategory || null
                })
            });

            hideLoading();

            if (response.ok) {
                await notify({ type: "success", title: "Story Published!", text: "Your story is now live." });
                window.location.href = ROUTES.HOME;
            } else if (response.status === 401) {
                await notify({
                    type: "warning",
                    title: "Login Required",
                    text: "Please log in to publish your story.",
                    onClick: () => { window.location.href = ROUTES.LOGIN; }
                });
                window.location.href = ROUTES.LOGIN;
            } else {
                const errData = await response.json().catch(() => ({}));
                notify({ type: "error", title: "Publish Failed", text: errData.detail || "Unable to publish story." });
            }
        } catch (error) {
            hideLoading();
            console.error("Network error:", error);
            notify({ type: "error", title: "Connection Error", text: "Could not connect to server. Please try again." });
        }
    });
});
