import { API_URL, ROUTES, notify } from "./config.js?v=20260818";

let skip = 0;
const limit = 6;
let currentSearch = "";
let isLoading = false;

const PALETTES = [
    { gradient: "linear-gradient(135deg, #ff6b6b 0%, #a855f7 50%, #6366f1 100%)", icon: "✨", category: "Creative" },
    { gradient: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)", icon: "🌊", category: "Tech" },
    { gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)", icon: "🌿", category: "Life" },
    { gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f43f5e 100%)", icon: "🚀", category: "Ideas" },
    { gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)", icon: "💡", category: "Insights" },
    { gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)", icon: "🔮", category: "Thoughts" },
    { gradient: "linear-gradient(135deg, #0ea5e9 0%, #14b8a6 50%, #84cc16 100%)", icon: "⚡", category: "Design" },
    { gradient: "linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%)", icon: "✦", category: "Story" }
];

// Content keywords for theme detection
const CONTENT_KEYWORDS = {
    tech: ["code", "programming", "software", "data", "algorithm", "web", "app", "developer", "python", "javascript", "database", "server", "api", "tech", "computer", "digital", "technology", "ai", "cyber", "framework", "library"],
    life: ["life", "people", "human", "family", "friend", "love", "health", "happiness", "experience", "journey", "growth", "story", "moment", "memory", "nature", "travel", "adventure", "peace", "home", "living"],
    creative: ["art", "design", "creative", "music", "paint", "draw", "beautiful", "aesthetic", "craft", "create", "visual", "color", "inspire", "artistic", "gallery", "photo", "photography"],
    ideas: ["idea", "think", "thought", "concept", "philosophy", "perspective", "vision", "dream", "possibility", "potential", "innovation", "future", "change", "better"],
    insights: ["insight", "learn", "knowledge", "wisdom", "understand", "realize", "discover", "lesson", "truth", "meaning", "purpose", "deep", "teach", "guide", "explain"],
    thoughts: ["think", "thought", "mind", "feel", "feeling", "emotion", "wonder", "question", "curious", "reflect", "ponder", "soul", "heart", "fear", "hope", "inner"],
    design: ["design", "ui", "ux", "interface", "layout", "visual", "user", "experience", "build", "pattern", "architecture", "minimal", "modern", "product"]
};

// Detect theme from content
function detectContentTheme(title, body) {
    const text = `${title || ""} ${body || ""}`.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];
    
    const scores = {};
    for (const [theme, keywords] of Object.entries(CONTENT_KEYWORDS)) {
        scores[theme] = keywords.reduce((count, keyword) => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = text.match(regex) || [];
            return count + matches.length;
        }, 0);
    }
    
    let bestTheme = null;
    let bestScore = 0;
    for (const [theme, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestTheme = theme;
        }
    }
    
    // Fallback based on content length
    if (bestScore === 0) {
        if (words.length > 500) bestTheme = 'insights';
        else if (words.length > 200) bestTheme = 'thoughts';
        else bestTheme = 'creative';
    }
    
    return bestTheme;
}

// Map detected theme to palette
function getThemePalette(themeName) {
    const themeMap = {
        'tech': PALETTES[1],      // 🤖 Tech - blue
        'life': PALETTES[2],      // 🌿 Life - green  
        'creative': PALETTES[0],  // ✨ Creative - purple/pink
        'ideas': PALETTES[3],     // 🚀 Ideas - pink/red
        'insights': PALETTES[4],  // 💡 Insights - orange
        'thoughts': PALETTES[5],  // 🔮 Thoughts - purple
        'design': PALETTES[6],    // ⚡ Design - teal
        'story': PALETTES[7]      // ✦ Story - blue/purple
    };
    return themeMap[themeName] || PALETTES[0];
}

function hashString(str = "") {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getBlogPlaceholderTheme(blog) {
    // Use custom category if set, otherwise detect from content
    let detectedTheme;
    if (blog.category && blog.category.trim()) {
        detectedTheme = blog.category.toLowerCase().trim();
    } else {
        detectedTheme = detectContentTheme(blog.title, blog.body);
    }
    const palette = getThemePalette(detectedTheme);

    const authorInitials = (blog.creator?.name || "Lumora Author")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || "")
        .join("") || "L";

    return {
        ...palette,
        authorInitials,
        authorName: blog.creator?.name || "Lumora Writer"
    };
}

export function calculateReadTime(text = "") {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 180));
    return `${minutes} min read`;
}

function formatBangladeshDate(value) {
    if (!value) return "Just now";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";

    return new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderSkeletonCards(count = 4) {
    const section = document.getElementById("blog_section");
    if (!section) return;
    let html = "";
    for (let i = 0; i < count; i++) {
        html += `
            <div class="blog-card blog-card-skeleton" aria-hidden="true">
                <div class="skeleton-media shimmer"></div>
                <div class="skeleton-body">
                    <div class="skeleton-pill shimmer"></div>
                    <div class="skeleton-title shimmer"></div>
                    <div class="skeleton-title short shimmer"></div>
                    <div class="skeleton-text shimmer"></div>
                </div>
            </div>
        `;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "skeleton-wrapper";
    wrapper.id = "skeleton-wrapper";
    wrapper.innerHTML = html;
    section.appendChild(wrapper);
}

function removeSkeletonCards() {
    const wrapper = document.getElementById("skeleton-wrapper");
    if (wrapper) wrapper.remove();
}


export function createBlogCardElement(blog) {
    const theme = getBlogPlaceholderTheme(blog);
    const readTime = calculateReadTime(blog.body);
    const hasImage = Boolean(blog.image_url && blog.image_url.trim().length > 5);
    const cleanImageUrl = hasImage ? blog.image_url.trim() : "";
    const likesCount = Number(blog.likes_count || 0);
    const commentsCount = Number(blog.comments_count || 0);

    const article = document.createElement("article");
    article.className = "blog-card";
    article.setAttribute("role", "article");
    article.setAttribute("tabindex", "0");
    article.setAttribute("aria-label", blog.title || "Story");

    const snippet = blog.body
        ? blog.body.replace(/(\r\n|\n|\r)/gm, " ").slice(0, 110) + (blog.body.length > 110 ? "..." : "")
        : "";

    article.innerHTML = `
        <div class="blog-card-media">
            ${hasImage ? `
                <img 
                    src="${escapeHtml(cleanImageUrl)}" 
                    alt="${escapeHtml(blog.title)}" 
                    class="blog-card-img" 
                    loading="lazy" 
                    decoding="async"
                    onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden-fallback');"
                >
                <div class="blog-card-placeholder hidden-fallback" style="background: ${theme.gradient};">
                    <div class="placeholder-decor">
                        <span class="placeholder-icon">${theme.icon}</span>
                        <span class="placeholder-category">${theme.category}</span>
                    </div>
                </div>
            ` : `
                <div class="blog-card-placeholder" style="background: ${theme.gradient};">
                    <div class="placeholder-decor">
                        <span class="placeholder-icon">${theme.icon}</span>
                        <span class="placeholder-category">${theme.category}</span>
                    </div>
                </div>
            `}
            <div class="blog-card-badge-row">
                <span class="blog-card-badge">${theme.category}</span>
                <span class="blog-card-readtime">⏱ ${readTime}</span>
            </div>
        </div>

        <div class="blog-card-content">
            <h3 class="blog-card-title">${escapeHtml(blog.title)}</h3>
            <p class="blog-card-snippet">${escapeHtml(snippet)}</p>

            <div class="blog-card-meta-row">
                <span class="blog-card-date">📅 ${escapeHtml(formatBangladeshDate(blog.created_at))}</span>
            </div>

            <div class="blog-card-metrics" aria-label="Likes and comments">
                <span class="blog-card-stat"><span class="stat-icon">❤️</span> ${likesCount}</span>
                <span class="blog-card-stat"><span class="stat-icon">💬</span> ${commentsCount}</span>
            </div>

            <div class="blog-card-footer">
                <div class="blog-card-author">
                    <div class="author-avatar" style="background: ${theme.gradient};" aria-hidden="true">
                        ${theme.authorInitials}
                    </div>
                    <div class="author-meta">
                        <span class="author-name">${escapeHtml(theme.authorName)}</span>
                    </div>
                </div>

                <div class="blog-card-action">
                    <span class="read-action-text">Read story</span>
                    <span class="read-action-arrow" aria-hidden="true">→</span>
                </div>
            </div>
        </div>
    `;

    article.addEventListener("click", () => readMore(blog.id));
    article.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            readMore(blog.id);
        }
    });

    return article;
}

async function loadBlogs(search = "", append = false) {
    if (isLoading) return;
    isLoading = true;

    const loadMoreButton = document.getElementById("load_more");
    const section = document.getElementById("blog_section");

    if (!append) {
        section.innerHTML = "";
    }

    renderSkeletonCards(append ? 2 : 4);

    if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.classList.add("loading");
    }

    try {
        const response = await fetch(
            `${API_URL}/blog?limit=${limit}&skip=${skip}&q=${encodeURIComponent(search)}`
        );

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        const blogs = Array.isArray(data.blogs) ? data.blogs : [];
        const total = typeof data.total === "number" ? data.total : blogs.length;

        removeSkeletonCards();

        if (blogs.length === 0 && !append) {
            if (loadMoreButton) loadMoreButton.style.display = "none";

            const emptyState = document.createElement("div");
            emptyState.className = "empty-blog-state";
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>${search ? "No stories found" : "No stories published yet"}</h3>
                <p>${
                    search
                        ? `We couldn't find any articles matching "<strong>${escapeHtml(search)}</strong>". Try different keywords or clear the search.`
                        : "Be the first to publish a captivating story and share your thoughts with the world!"
                }</p>
                <div class="empty-actions">
                    ${search ? `<button type="button" class="btn-clear-search" id="empty-clear-btn">Clear Search</button>` : `<a href="/create-blog" class="hero-btn hero-btn-primary">Write First Story ✍️</a>`}
                </div>
            `;
            section.appendChild(emptyState);

            const emptyClearBtn = document.getElementById("empty-clear-btn");
            if (emptyClearBtn) {
                emptyClearBtn.addEventListener("click", () => {
                    const searchBar = document.getElementById("search_bar");
                    if (searchBar) searchBar.value = "";
                    updateClearButtonVisibility();
                    performSearch();
                });
            }

            return;
        }

        blogs.forEach(blog => {
            const card = createBlogCardElement(blog);
            section.appendChild(card);
        });

        skip += blogs.length;

        if (loadMoreButton) {
            if (skip >= total || blogs.length < limit) {
                loadMoreButton.style.display = "none";
            } else {
                loadMoreButton.style.display = "inline-flex";
            }
        }
    } catch (error) {
        removeSkeletonCards();
        console.error("Failed to load blogs:", error);
        notify({
            type: "error",
            title: "Could not load blogs",
            text: "Failed to connect to the server. Please refresh or try again later."
        });
    } finally {
        isLoading = false;
        if (loadMoreButton) {
            loadMoreButton.disabled = false;
            loadMoreButton.classList.remove("loading");
        }
    }
}

function updateClearButtonVisibility() {
    const searchBar = document.getElementById("search_bar");
    const clearBtn = document.getElementById("clear_search");
    if (!searchBar || !clearBtn) return;

    if (searchBar.value.trim().length > 0) {
        clearBtn.classList.remove("hidden");
    } else {
        clearBtn.classList.add("hidden");
    }
}

async function performSearch() {
    const searchBar = document.getElementById("search_bar");
    currentSearch = searchBar ? searchBar.value.trim() : "";
    skip = 0;
    await loadBlogs(currentSearch, false);
}

async function loadMore() {
    await loadBlogs(currentSearch, true);
}

async function readMore(id) {
    const token = localStorage.getItem("token");

    if (!token) {
        await notify({
            type: "warning",
            title: "Login Required",
            text: "Please log in to read this full story.",
            onClick: () => {
                window.location.href = ROUTES.LOGIN;
            }
        });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    window.location.href = `/blogs/${id}`;
}

window.readMore = readMore;



document.addEventListener("DOMContentLoaded", () => {
    const searchBtn = document.getElementById("search_button");
    const searchBar = document.getElementById("search_bar");
    const clearSearchBtn = document.getElementById("clear_search");
    const loadMoreBtn = document.getElementById("load_more");

    if (searchBtn) {
        searchBtn.addEventListener("click", (e) => {
            e.preventDefault();
            performSearch();
        });
    }

    if (searchBar) {
        searchBar.addEventListener("input", updateClearButtonVisibility);
        searchBar.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                performSearch();
            }
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", () => {
            if (searchBar) {
                searchBar.value = "";
                searchBar.focus();
            }
            updateClearButtonVisibility();
            performSearch();
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener("click", loadMore);
    }

    loadBlogs();
});
