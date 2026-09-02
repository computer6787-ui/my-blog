import { API_URL, ROUTES, showLoading, hideLoading, notify, confirmDialog } from "./config.js?v=20260902";
import { setupMentionAutocomplete } from "./mention-autocomplete.js?v=20260909";

const id = window.location.pathname.split("/").pop();

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

// Content analysis keywords mapped to themes
const CONTENT_THEMES = {
    Tech: {
        keywords: ["code", "programming", "software", "data", "algorithm", "web", "app", "developer", "python", "javascript", "database", "server", "api", "tech", "computer", "digital", "technology", "framework", "library", "debug"],
        weight: 1
    },
    Life: {
        keywords: ["life", "people", "human", "family", "friend", "love", "health", "happiness", "experience", "journey", "growth", "story", "moment", "memory", "personal", "live", "living", "day", "time", "world"],
        weight: 1
    },
    Creative: {
        keywords: ["art", "design", "creative", "music", "paint", "draw", "imagine", "beautiful", "aesthetic", "style", "craft", "create", "visual", "color", "inspire", "inspiration"],
        weight: 1
    },
    Ideas: {
        keywords: ["idea", "think", "thought", "concept", "philosophy", "perspective", "believe", "vision", "dream", "possibility", "potential", "innovation", "imagine", "consider"],
        weight: 1
    },
    Insights: {
        keywords: ["insight", "learn", "knowledge", "wisdom", "understand", "realize", "discover", "lesson", "truth", "meaning", "purpose", "deep", "profound", "reveal"],
        weight: 1
    },
    Thoughts: {
        keywords: ["think", "thought", "mind", "feel", "feeling", "emotion", "wonder", "question", "curious", "reflect", "ponder", "contemplate", "inner"],
        weight: 1
    },
    Design: {
        keywords: ["design", "ui", "ux", "interface", "layout", "visual", "aesthetic", "user", "experience", "build", "create", "pattern", "system"],
        weight: 1
    }
};

// Negative/toxic content keywords (should use neutral/calming themes)
const TOXIC_KEYWORDS = ["fuck", "shit", "damn", "hell", "ass", "bitch", "bastard", "crap", "piss", "motherfuck"];

function hashString(str = "") {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Analyzes story content and returns appropriate theme
function analyzeStoryContent(title = "", body = "") {
    const fullText = `${title} ${body}`.toLowerCase();
    const words = fullText.match(/\b\w+\b/g) || [];
    
    // Check if content has toxic/profane language
    const hasToxicContent = TOXIC_KEYWORDS.some(word => fullText.includes(word));
    
    // If toxic content detected, use calming themes (Life, Thoughts, Insights)
    if (hasToxicContent) {
        const calmingThemes = [
            { gradient: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)", icon: "🌿", category: "Life" },
            { gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)", icon: "🔮", category: "Thoughts" },
            { gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)", icon: "💡", category: "Insights" }
        ];
        return calmingThemes[hashString(title) % calmingThemes.length];
    }
    
    // Score each theme based on keyword matches
    const themeScores = {};
    
    for (const [themeName, themeData] of Object.entries(CONTENT_THEMES)) {
        let score = 0;
        themeData.keywords.forEach(keyword => {
            // Count word occurrences (case-insensitive whole word match)
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = fullText.match(regex) || [];
            score += matches.length;
        });
        themeScores[themeName] = score;
    }
    
    // Find the theme with the highest score
    let bestTheme = null;
    let bestScore = 0;
    
    for (const [themeName, score] of Object.entries(themeScores)) {
        if (score > bestScore) {
            bestScore = score;
            bestTheme = themeName;
        }
    }
    
    // If no clear theme found (score is 0), use a sensible default based on content length
    if (!bestTheme || bestScore === 0) {
        // Longer content → more reflective; shorter → more creative
        if (words.length > 500) {
            bestTheme = "Insights";
        } else if (words.length > 200) {
            bestTheme = "Thoughts";
        } else {
            bestTheme = "Creative";
        }
    }
    
    // Return the matching palette for the best theme
    return PALETTES.find(p => p.category === bestTheme) || PALETTES[0];
}

function calculateReadTime(text = "") {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return `${Math.max(1, Math.ceil(words / 180))} min read`;
}

function formatBangladeshDate(value) {
    if (!value) return "Just now";

    let date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";

    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(value))) {
        date = new Date(`${String(value).replace(" ", "T")}Z`);
    }

    if (Number.isNaN(date.getTime())) return "Just now";

    const diffMs = Date.now() - date.getTime();
    const ageInDays = diffMs / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
        return "long time ago";
    }

    return new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(date);
}

// Escapes user text, then wraps every "@name" mention (including multi-word
// names) in a colored, clickable .mention-chip span so mentions stand out and
// can navigate to the mentioned user's profile. Runs on the escaped string so
// chip attributes are safe from HTML injection.
function renderMentionsAsChips(safeText) {
    return safeText.replace(
        /@([\w]+(?: [A-Z][\w]*)*)/g,
        (match, username) =>
            `<span class="mention-chip" data-username="${escapeHtml(username)}">@${escapeHtml(username)}</span>`
    );
}

// Attach click navigation to every mention chip in the rendered blog body.
// Since blog bodies don't carry resolved user ids, we look the name up live,
// exactly like the "unknown mention" fallback used for comments.
function attachBodyMentionClicks(container) {
    if (!container) return;
    container.querySelectorAll(".mention-chip").forEach(chip => {
        chip.addEventListener("click", async (e) => {
            e.stopPropagation();
            const username = (chip.dataset.username || "").trim();
            if (!username) return;
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await fetch(`${API_URL}/user/search?q=${encodeURIComponent(username)}&limit=5`, { headers });
                if (response.ok) {
                    const users = await response.json();
                    const match = users.find(u => (u.name || "").toLowerCase() === username.toLowerCase());
                    if (match) {
                        window.location.href = profileUrlForUser(match.id);
                        return;
                    }
                }
            } catch (error) {
                // ignore, fall through to no-op
            }
        });
    });
}

function formatBody(text = "") {
    if (!text) return "";
    // Escape first so raw user HTML can't break out of the <p> wrappers, then
    // render mention chips, then (re)build paragraphs on blank-line boundaries.
    const escaped = escapeHtml(text);
    const withChips = renderMentionsAsChips(escaped);
    return withChips.split(/\n{2,}/)
        .map(p => {
            // Preserve leading indentation and multiple spaces exactly as stored.
            // White-space: pre-wrap on .single-story-content renders them as-is.
            const clean = p.replace(/\n/g, "<br>");
            return clean ? `<p>${clean}</p>` : "";
        })
        .join("");
}


async function loadBlog() {
    const token = localStorage.getItem("token");
    showLoading("Loading story...");

    try {
        const response = await fetch(`${API_URL}/blog/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
            hideLoading();
            await notify({
                type: "warning",
                title: "Login Required",
                text: "Please log in to read this story.",
                onClick: () => { window.location.href = ROUTES.LOGIN; }
            });
            window.location.href = ROUTES.LOGIN;
            return;
        }

        if (!response.ok) {
            hideLoading();
            await notify({ type: "error", title: "Story Not Found", text: "This story is not available." });
            window.location.href = ROUTES.HOME;
            return;
        }

        const blog = await response.json();
        const authorName = blog.creator?.name || "Lumora Writer";
        const authorInitial = authorName.trim()[0]?.toUpperCase() || "L";
        const authorProfilePicture = blog.creator?.profile_picture_url || "";
        const savedAuthorBio = (blog.creator?.bio || "").trim();
        const authorBio = savedAuthorBio || "Sharing ideas and stories that inspire and connect us all on Lumora.";
        const readTime = calculateReadTime(blog.body);
        const authorProfileTarget = (() => {
            const authorId = blog.creator?.id;
            if (!authorId) return "/";
            try {
                const token = localStorage.getItem("token");
                if (!token) return `/profile/${authorId}`;
                const parsed = JSON.parse(atob(token.split(".")[1] || ""));
                const currentUserId = Number(parsed?.sub || parsed?.user_id || parsed?.id || 0);
                return currentUserId === Number(authorId) ? "/user" : `/profile/${authorId}`;
            } catch {
                return `/profile/${authorId}`;
            }
        })();
        // Use intelligent content analysis instead of random hashing
        const theme = analyzeStoryContent(blog.title, blog.body);

        document.title = `${blog.title} - Lumora`;
        document.getElementById("title").textContent = blog.title;
        const authorLink = document.getElementById("author");
        const authorAvatarLink = document.getElementById("author-avatar-link");
        const footerAvatarLink = document.getElementById("footer-author-avatar-link");
        if (authorAvatarLink) authorAvatarLink.href = authorProfileTarget;
        if (footerAvatarLink) footerAvatarLink.href = authorProfileTarget;
        if (authorLink) {
            authorLink.textContent = authorName;
            authorLink.style.cursor = "pointer";
            authorLink.onclick = () => { window.location.href = authorProfileTarget; };
        }
        const footerAuthorBioEl = document.getElementById("footer-author-bio");
        if (footerAuthorBioEl) {
            footerAuthorBioEl.textContent = authorBio;
        }
        const bodyEl = document.getElementById("body");
        bodyEl.innerHTML = formatBody(blog.body);
        attachBodyMentionClicks(bodyEl);

        const readTimeEl = document.getElementById("story-readtime");
        if (readTimeEl) readTimeEl.textContent = `⏱ ${readTime}`;

        const storyDateEl = document.getElementById("story-date");
        if (storyDateEl) storyDateEl.textContent = `📅 ${formatBangladeshDate(blog.created_at)}`;

        const categoryEl = document.getElementById("story-category");
        if (categoryEl) categoryEl.textContent = `✦ ${theme.category}`;

        const avatarEl = document.getElementById("author-avatar");
        if (avatarEl) {
            if (authorProfilePicture) {
                avatarEl.innerHTML = `<img src="${authorProfilePicture}" alt="${authorName}" class="profile-avatar-image">`;
                avatarEl.style.background = "transparent";
            } else {
                avatarEl.textContent = authorInitial;
                avatarEl.style.background = theme.gradient;
            }
        }

        const footerAvatarEl = document.getElementById("footer-author-avatar");
        const footerNameEl = document.getElementById("footer-author-name");
        if (footerAvatarEl) {
            if (authorProfilePicture) {
                footerAvatarEl.innerHTML = `<img src="${authorProfilePicture}" alt="${authorName}" class="profile-avatar-image">`;
                footerAvatarEl.style.background = "transparent";
            } else {
                footerAvatarEl.textContent = authorInitial;
                footerAvatarEl.style.background = theme.gradient;
            }
        }
        if (footerNameEl) {
            footerNameEl.textContent = authorName;
            footerNameEl.style.cursor = "pointer";
            footerNameEl.onclick = () => { window.location.href = authorProfileTarget; };
        }

        const coverImg = document.getElementById("story-cover-img");
        const coverPlaceholder = document.getElementById("story-cover-placeholder");
        const coverIcon = document.getElementById("cover-icon");
        const coverCategory = document.getElementById("cover-category");

        if (coverPlaceholder) {
            coverPlaceholder.style.background = theme.gradient;
            if (coverIcon) coverIcon.textContent = theme.icon;
            if (coverCategory) coverCategory.textContent = theme.category;
        }

        if (blog.image_url && blog.image_url.trim().length > 5) {
            coverImg.src = blog.image_url.trim();
            coverImg.onload = () => {
                coverImg.classList.remove("hidden");
                if (coverPlaceholder) coverPlaceholder.classList.add("hidden");
            };
            coverImg.onerror = () => {
                coverImg.classList.add("hidden");
                if (coverPlaceholder) coverPlaceholder.classList.remove("hidden");
            };
        } else {
            coverImg.classList.add("hidden");
            if (coverPlaceholder) coverPlaceholder.classList.remove("hidden");
        }

        const copyBtn = document.getElementById("btn-copy-link");
        if (copyBtn) {
            copyBtn.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    notify({ type: "success", title: "Link Copied!", text: "Story link copied to clipboard." });
                } catch {
                    notify({ type: "info", title: "Story URL", text: window.location.href });
                }
            });
        }
    } catch (error) {
        console.error(error);
        notify({ type: "error", title: "Connection Error", text: "Could not load this story right now." });
    } finally {
        hideLoading();
    }
}

loadBlog();

// ========================
// Like and Comments System
// ========================

let currentUserId = null;
let blogId = parseInt(id);
let userHasLiked = false;
let likesCount = 0;

// Check auth and load initial state
async function initInteraction() {
    try {
        const token = localStorage.getItem("token");
        if (!token) {
            disableInteractionButtons();
            return;
        }

        const userRes = await fetch(`${API_URL}/user/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!userRes.ok) {
            localStorage.removeItem("token");
            disableInteractionButtons();
            notify({ type: "warning", title: "Session expired", text: "Please log in again." });
            window.location.href = ROUTES.LOGIN;
            return;
        }

        const userData = await userRes.json();
        currentUserId = userData.id;

        await loadLikeStatus();
        await loadComments();
        setupInteractionListeners();
    } catch (error) {
        console.error("Error initializing interactions:", error);
        localStorage.removeItem("token");
        disableInteractionButtons();
        window.location.href = ROUTES.LOGIN;
    }
}

function disableInteractionButtons() {
    const likeBtn = document.getElementById("btn-like");
    const commentToggle = document.getElementById("btn-comments-toggle");
    const commentForm = document.getElementById("comment-form");
    
    if (likeBtn) {
        likeBtn.classList.add("disabled");
        likeBtn.title = "Login to like";
    }
    if (commentToggle) {
        commentToggle.classList.add("disabled");
        commentToggle.title = "Login to view comments";
    }
    if (commentForm) commentForm.classList.add("hidden");
}

async function loadLikeStatus() {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    try {
        const response = await fetch(`${API_URL}/interact/like/${blogId}/status`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            userHasLiked = data.liked;
            likesCount = data.likes_count;
            updateLikeButton();
        }
    } catch (error) {
        console.error("Error loading like status:", error);
    }
}

function updateLikeButton() {
    const likeBtn = document.getElementById("btn-like");
    const likesCountEl = document.getElementById("likes-count");
    
    if (likeBtn) {
        if (userHasLiked) likeBtn.classList.add("liked");
        else likeBtn.classList.remove("liked");
    }
    if (likesCountEl) likesCountEl.textContent = likesCount;
}

async function toggleLike() {
    const token = localStorage.getItem("token");
    if (!token || !currentUserId) {
        localStorage.removeItem("token");
        notify({ type: "info", title: "Login Required", text: "Please login to like stories." });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    const likeBtn = document.getElementById("btn-like");
    if (likeBtn && likeBtn.classList.contains("disabled")) return;

    // Disable button to prevent multiple clicks during request
    if (likeBtn) likeBtn.classList.add("disabled");

    try {
        const response = await fetch(`${API_URL}/interact/like/${blogId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            credentials: "include"
        });

        if (response.ok) {
            const data = await response.json();
            userHasLiked = data.liked;
            likesCount = data.likes_count;
            updateLikeButton();
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            notify({ type: "info", title: "Login Required", text: "Please login to like stories." });
            window.location.href = ROUTES.LOGIN;
        }
    } catch (error) {
        console.error("Error toggling like:", error);
    } finally {
        // Re-enable button after request completes
        if (likeBtn) likeBtn.classList.remove("disabled");
    }
}

// Comments
async function loadComments() {
    try {
        const response = await fetch(`${API_URL}/interact/comments/${blogId}`, { credentials: "include" });
        if (response.ok) {
            const comments = await response.json();
            renderComments(comments);
            const commentsCountEl = document.getElementById("comments-count");
            if (commentsCountEl) commentsCountEl.textContent = comments.length;
        }
    } catch (error) {
        console.error("Error loading comments:", error);
    }
}

function renderComments(comments) {
    const commentsList = document.getElementById("comments-list");
    if (!commentsList) return;

    if (comments.length === 0) {
        commentsList.innerHTML = '<p class="no-comments">No comments yet. Be the first to share your thoughts!</p>';
        return;
    }

    commentsList.innerHTML = comments.map(comment => renderCommentItem(comment)).join("");

    commentsList.querySelectorAll(".btn-reply-comment").forEach(btn => {
        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            openReplyForm(this.dataset.id, this.dataset.name);
        });
    });

    commentsList.querySelectorAll(".btn-delete-comment").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            await deleteComment(e.currentTarget.dataset.id);
        });
    });

    commentsList.querySelectorAll(".mention-chip").forEach(chip => {
        chip.addEventListener("click", async (e) => {
            e.stopPropagation();
            const username = chip.dataset.username;
            if (!username) return;

            // Known mention: the user id was included at render time, so we can
            // jump straight to their profile (accounting for the current user).
            const userId = Number(chip.dataset.userId);
            if (userId) {
                window.location.href = profileUrlForUser(userId);
                return;
            }

            // Unknown mention (user not resolved when comment loaded): fall back
            // to a live username search to find their profile.
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await fetch(`${API_URL}/user/search?q=${encodeURIComponent(username)}&limit=5`, { headers });
                if (response.ok) {
                    const users = await response.json();
                    const match = users.find(u => u.name.toLowerCase() === username.toLowerCase());
                    if (match) {
                        window.location.href = `/profile/${match.id}`;
                        return;
                    }
                }
            } catch (error) {
                // ignore, fall through to no-op
            }
        });
    });
}

function formatCommentDate(value) {
    let date = new Date(value);
    const rawValue = value;
    if (rawValue && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(rawValue))) {
        date = new Date(`${String(rawValue).replace(" ", "T")}Z`);
    }
    return new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(date);
}

// Turns "@username" occurrences into clickable mention chips.
// Known mentions (resolved users) get a data-user-id so clicking can jump
// straight to their profile without an extra lookup.
function renderCommentText(content, mentions = null) {
    const safe = escapeHtml(content);
    const mentionsById = new Map((mentions || []).map(m => [m.mentioned_user_name, m.mentioned_user_id]));

    // Multi-word names are supported: capture "@" + the first word, then keep
    // consuming each following capitalized word (e.g. "John Doe", "Ann Marie")
    // while stopping at punctuation, lowercase prose words, or the end.
    return safe.replace(/@([\w]+(?: [A-Z][\w]*)*)/g, (match, username) => {
        const userId = mentionsById.get(username);
        const known = userId ? "" : " unknown";
        const dataUserId = userId ? ` data-user-id="${Number(userId)}"` : "";
        return `<span class="mention-chip${known}" data-username="${escapeHtml(username)}"${dataUserId}>@${escapeHtml(username)}</span>`;
    });
}

function profileUrlForUser(userId) {
    if (!userId) return "#";
    try {
        const token = localStorage.getItem("token");
        let currentId = null;
        if (token) {
            const parsed = JSON.parse(atob(token.split(".")[1] || ""));
            currentId = Number(parsed?.sub || parsed?.user_id || parsed?.id || 0);
        }
        return currentId && currentId === Number(userId) ? ROUTES.PROFILE : `/profile/${userId}`;
    } catch {
        return `/profile/${userId}`;
    }
}

// Flatten nested reply chains: a reply to a reply is rendered as a sibling
// directly below its parent (prefixed with "@name") instead of being nested
// ever deeper, so long reply threads never run out of space.
function renderFlatReplies(comment) {
    const parts = [];
    const walk = (parentNode, depth) => {
        (parentNode.replies || []).forEach(reply => {
            const isReplyToReply = depth > 0;
            // includeReplies=false prevents the reply from re-rendering its own
            // children (they are collected here as flat siblings instead).
            parts.push(renderCommentItem(reply, true, isReplyToReply ? parentNode : null, false));
            walk(reply, depth + 1);
        });
    };
    walk(comment, 0);
    return parts.join("");
}

function renderCommentItem(comment, isReply = false, replyTo = null, includeReplies = true) {
    const dateStr = formatCommentDate(comment.created_at);
    const isOwner = currentUserId === comment.user_id;
    const replyText = includeReplies ? renderFlatReplies(comment) : "";
    // The "@name" prefix on a reply-to-reply points at who was replied to, and
    // links through to that user's profile.
    const atPrefix = replyTo
        ? `<a class="comment-at-label" href="${profileUrlForUser(replyTo.user_id)}">@${escapeHtml(replyTo.user_name)}</a> `
        : "";

    return `
        <div class="${isReply ? "comment-reply" : "comment-item"}" id="comment-${comment.id}" data-comment-id="${comment.id}">
            <a class="comment-avatar" href="${profileUrlForUser(comment.user_id)}" aria-label="View ${escapeHtml(comment.user_name)}'s profile">
                ${comment.user_profile_picture_url
                    ? `<img src="${escapeHtml(comment.user_profile_picture_url)}" alt="${escapeHtml(comment.user_name)}" class="comment-avatar-image" loading="lazy" onerror="this.parentElement.textContent='${comment.user_initial}'">`
                    : comment.user_initial}
            </a>
            <div class="comment-content-wrap">
                <div class="comment-header">
                    <a class="comment-author" href="${profileUrlForUser(comment.user_id)}">${comment.user_name}</a>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <p class="comment-text">${atPrefix}${renderCommentText(comment.content, comment.mentions)}</p>
                <div class="comment-actions">
                    <button type="button" class="btn-reply-comment" data-id="${comment.id}" data-name="${comment.user_name}">↩ Reply</button>
                    ${isOwner ? `<button class="btn-delete-comment" data-id="${comment.id}">Delete</button>` : ''}
                </div>
                ${replyText ? `<div class="comment-replies">${replyText}</div>` : ""}
            </div>
        </div>
    `;
}
function openReplyForm(commentId, userName) {
    const targetComment = document.getElementById(`comment-${commentId}`);
    if (!targetComment) return;

    // Remove any open reply forms first
    document.querySelectorAll(".comment-reply-form").forEach(f => f.remove());

    const formWrap = document.createElement("form");
    formWrap.className = "comment-reply-form";
    formWrap.innerHTML = `
        <textarea class="comment-input reply-input" rows="2" placeholder="Reply to ${escapeHtml(userName)}..." data-parent-id="${commentId}"></textarea>
        <div class="reply-form-actions">
            <button type="button" class="btn-reply-cancel">Cancel</button>
            <button type="submit" class="btn-submit-comment">Reply</button>
        </div>
    `;
    targetComment.querySelector(".comment-content-wrap").appendChild(formWrap);

    const textarea = formWrap.querySelector("textarea");
    textarea.focus();
    setupMentionAutocomplete(textarea);

    formWrap.querySelector(".btn-reply-cancel").addEventListener("click", () => {
        formWrap.remove();
    });

    formWrap.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitReply(textarea, formWrap);
    });
}

async function submitReply(textarea, formWrap) {
    const token = localStorage.getItem("token");
    if (!token || !currentUserId) {
        localStorage.removeItem("token");
        notify({ type: "info", title: "Login Required", text: "Please login to reply." });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    // Prevent accidental double posts: block further submits while posting
    if (textarea.dataset.posting === "1") return;
    textarea.dataset.posting = "1";

    const submitBtn = formWrap.querySelector(".btn-submit-comment");
    if (submitBtn) submitBtn.disabled = true;

    const parentId = textarea.dataset.parentId;
    const content = textarea.value.trim();
    if (!content) {
        if (submitBtn) submitBtn.disabled = false;
        delete textarea.dataset.posting;
        notify({ type: "error", title: "Empty Reply", text: "Please write something before replying." });
        return;
    }

    try {
        const response = await fetch(`${API_URL}/interact/comment`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            credentials: "include",
            body: JSON.stringify({ blog_id: blogId, content, parent_id: Number(parentId) })
        });

        if (response.ok) {
            formWrap.remove();
            await loadComments();
            notify({ type: "success", title: "Reply Posted", text: "Your reply has been added." });
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            notify({ type: "info", title: "Login Required", text: "Please login to reply." });
            window.location.href = ROUTES.LOGIN;
        } else {
            const err = await response.json();
            notify({ type: "error", title: "Error", text: err.detail || "Could not post reply." });
        }
    } catch (error) {
        console.error("Error posting reply:", error);
        notify({ type: "error", title: "Error", text: "Could not post reply." });
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        delete textarea.dataset.posting;
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
async function submitComment(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");
    if (!token || !currentUserId) {
        localStorage.removeItem("token");
        notify({ type: "info", title: "Login Required", text: "Please login to comment." });
        window.location.href = ROUTES.LOGIN;
        return;
    }

    const commentInput = document.getElementById("comment-input");
    const content = commentInput?.value?.trim();

    if (!content) {
        notify({ type: "error", title: "Empty Comment", text: "Please write something before posting." });
        return;
    }

    const submitBtn = document.getElementById("btn-submit-comment");
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/interact/comment`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        credentials: "include",
        body: JSON.stringify({ blog_id: blogId, content })
    });

        if (response.ok) {
            commentInput.value = "";
            await loadComments();
            notify({ type: "success", title: "Comment Posted", text: "Your comment has been added." });
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            notify({ type: "info", title: "Login Required", text: "Please login to comment." });
            window.location.href = ROUTES.LOGIN;
        } else {
            const err = await response.json();
            notify({ type: "error", title: "Error", text: err.detail || "Could not post comment." });
        }
    } catch (error) {
        console.error("Error submitting comment:", error);
        notify({ type: "error", title: "Error", text: "Could not post comment." });
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function deleteComment(commentId) {
    const token = localStorage.getItem("token");

    const confirmed = await confirmDialog({
        title: "Delete Comment",
        text: "Are you sure you want to delete this comment? This action cannot be undone.",
        confirmText: "Delete",
        cancelText: "Cancel"
    });

    if (!confirmed) return;

    try {
        const response = await fetch(`${API_URL}/interact/comment/${commentId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            credentials: "include"
        });

        if (response.ok) {
            await notify({
                type: "success",
                title: "Comment Deleted",
                text: "Your comment has been removed."
            });
            await loadComments();
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            notify({ type: "info", title: "Login Required", text: "Please login again." });
            window.location.href = ROUTES.LOGIN;
        } else if (response.status === 403) {
            notify({ type: "error", title: "Permission Denied", text: "You can only delete your own comments." });
        } else {
            notify({ type: "error", title: "Delete Failed", text: "Could not delete the comment." });
        }
    } catch (error) {
        console.error("Error deleting comment:", error);
        notify({ type: "error", title: "Connection Error", text: "Could not connect to the server." });
    }
}

function toggleCommentsSection() {
    const commentsSection = document.getElementById("comments-section");
    if (commentsSection) commentsSection.classList.toggle("hidden");
}

function setupInteractionListeners() {
    const likeBtn = document.getElementById("btn-like");
    if (likeBtn) likeBtn.addEventListener("click", toggleLike);

    const commentsToggle = document.getElementById("btn-comments-toggle");
    if (commentsToggle) commentsToggle.addEventListener("click", toggleCommentsSection);

    const commentForm = document.getElementById("comment-form");
    if (commentForm) commentForm.addEventListener("submit", submitComment);

    const mainInput = document.getElementById("comment-input");
    if (mainInput) setupMentionAutocomplete(mainInput);
}

// ========================
// Mention Autocomplete
// ========================
// (provides setupMentionAutocomplete, imported from ./mention-autocomplete.js)
// ========================
// Scroll to comment from notification
// ========================

function scrollToCommentFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const commentId = params.get("comment");
    if (!commentId) return;

    const commentsSection = document.getElementById("comments-section");
    if (commentsSection && commentsSection.classList.contains("hidden")) {
        commentsSection.classList.remove("hidden");
    }

    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        const target = document.getElementById(`comment-${commentId}`);
        if (target) {
            clearInterval(timer);
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.classList.add("highlight-comment");
            setTimeout(() => target.classList.remove("highlight-comment"), 2600);
        } else if (attempts > 20) {
            clearInterval(timer);
        }
    }, 250);
}

initInteraction();
scrollToCommentFromUrl();