/* ==========================================================================
   LUMORA ARTICLE READER — renders Tiptap JSON to semantic HTML
   ==========================================================================
   Loaded on /blogs/{id}. Handles:
     - Parses body_format to decide renderer (tiptap JSON vs legacy plain text)
     - Renders Tiptap JSON nodes to semantic HTML matching editorial-content.css
     - Fallback to legacy plain-text renderer for old articles
     - Sanitizes all HTML to prevent XSS
   -------------------------------------------------------------------------- */

import { API_URL, showLoading, hideLoading, notify, confirmDialog } from "./config.js?v=20260902";

const id = window.location.pathname.split("/").pop();

/* ==========================================================================
   Tiptap JSON → HTML renderer
   ========================================================================== */

function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Basic HTML sanitization: remove script tags, strip event handlers, block javascript: URLs
function sanitizeHtml(html) {
    // Very lightweight sanitizer for Tiptap output (already structured)
    let clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/\s*on\w+\s*=\s*(["'])[^"']*\1/gi, "")
        .replace(/javascript:/gi, "");
    return clean;
}

// Recursively extract readable plain text from Tiptap JSON (for @mention rendering)
function extractTextFromNode(node) {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractTextFromNode).join("");
    }
    return "";
}

// Render inline marks (bold, italic, etc.)
function renderMarks(node) {
    if (!node.marks || !node.marks.length) return escapeHtml(node.text);
    let text = escapeHtml(node.text || "");

    // Sort marks to apply in safe order
    const marks = [...node.marks].sort((a, b) => {
        const order = { link: 1, bold: 2, italic: 3, underline: 4, strike: 5, code: 6 };
        return (order[a.type] || 99) - (order[b.type] || 99);
    });

    for (const mark of marks) {
        switch (mark.type) {
            case "bold": case "strong":
                text = `<strong>${text}</strong>`;
                break;
            case "italic": case "em":
                text = `<em>${text}</em>`;
                break;
            case "underline":
                text = `<u>${text}</u>`;
                break;
            case "strike": case "s":
                text = `<s>${text}</s>`;
                break;
            case "code":
                text = `<code>${text}</code>`;
                break;
            case "link":
                const href = escapeHtml(mark.attrs?.href || "");
                const target = mark.attrs?.target || "_blank";
                const rel = "noopener";
                text = `<a href="${href}" target="${target}" rel="${rel}">${text}</a>`;
                break;
        }
    }
    return text;
}

// Render a single node
function renderNode(node) {
    if (!node) return "";

    // Text node
    if (node.type === "text") {
        return renderMarks(node);
    }

    // Paragraph
    if (node.type === "paragraph") {
        const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : "";
        const content = (node.content || []).map(renderNode).join("");
        return `<p${align}>${content}</p>`;
    }

    // Headings
    if (node.type === "heading") {
        const level = node.attrs?.level || 2;
        const content = (node.content || []).map(renderNode).join("");
        return `<h${level}>${content}</h${level}>`;
    }

    // Bullet list
    if (node.type === "bulletList") {
        const items = (node.content || [])
            .filter(n => n.type === "listItem")
            .map(li => {
                const inner = (li.content || []).map(renderNode).join("");
                return `<li>${inner}</li>`;
            })
            .join("");
        return `<ul>${items}</ul>`;
    }

    // Ordered list
    if (node.type === "orderedList") {
        const items = (node.content || [])
            .filter(n => n.type === "listItem")
            .map(li => {
                const inner = (li.content || []).map(renderNode).join("");
                return `<li>${inner}</li>`;
            })
            .join("");
        return `<ol>${items}</ol>`;
    }

    // Blockquote
    if (node.type === "blockquote") {
        const content = (node.content || []).map(renderNode).join("");
        return `<blockquote>${content}</blockquote>`;
    }

    // Horizontal rule
    if (node.type === "horizontalRule") {
        return `<hr>`;
    }

    // Image (inline in paragraph)
    if (node.type === "image") {
        const src = escapeHtml(node.attrs?.src || "");
        const alt = escapeHtml(node.attrs?.alt || "");
        return `<figure><img src="${src}" alt="${alt}" loading="lazy"></figure>`;
    }

    // Figure with caption (our custom node)
    if (node.type === "figure") {
        const width = node.attrs?.width === "wide" ? ' data-width="wide"' : "";
        const img = node.content?.find(n => n.type === "image");
        const caption = node.content?.find(n => n.type === "figcaption");
        const src = img?.attrs?.src ? escapeHtml(img.attrs.src) : "";
        const alt = img?.attrs?.alt ? escapeHtml(img.attrs.alt) : "";
        const captionText = caption?.content ? (caption.content.map(renderNode).join("") || "") : "";
        const captionHtml = captionText ? `<figcaption>${captionText}</figcaption>` : "";
        return `<figure${width}><img src="${src}" alt="${alt}" loading="lazy">${captionHtml}</figure>`;
    }

    // Hard break
    if (node.type === "hardBreak") {
        return `<br>`;
    }

    // Code block
    if (node.type === "codeBlock") {
        const content = (node.content || []).map(renderNode).join("");
        return `<pre><code>${content}</code></pre>`;
    }

    // Unknown node — try recursing
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(renderNode).join("");
    }

    return "";
}

// Main: JSON → HTML
function renderTiptapJSON(jsonString, opts = {}) {
    if (!jsonString) return "";

    let json;
    try {
        json = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
        console.warn("Failed to parse Tiptap JSON:", e);
        return escapeHtml(jsonString);
    }

    if (!json || !json.content || !Array.isArray(json.content)) {
        return escapeHtml(jsonString);
    }

    let html = "";
    for (const node of json.content) {
        html += renderNode(node);
    }

    // Add drop-cap wrapper if requested
    if (opts.dropcap) {
        html = `<div class="has-dropcap">${html}</div>`;
    }

    return sanitizeHtml(html);
}

/* ==========================================================================
   Legacy plain-text renderer (preserved from sep_blog.js)
   ========================================================================== */

function renderMentionsAsChips(safeText) {
    return safeText.replace(
        /@([\w]+(?: [A-Z][\w]*)*)/g,
        (match, username) =>
            `<span class="mention-chip" data-username="${escapeHtml(username)}">@${escapeHtml(username)}</span>`
    );
}

function formatBodyLegacy(text = "") {
    if (!text) return "";
    const escaped = escapeHtml(text);
    const withChips = renderMentionsAsChips(escaped);
    return withChips.split(/\n{2,}/)
        .map(p => {
            const clean = p.replace(/\n/g, "<br>");
            return clean ? `<p>${clean}</p>` : "";
        })
        .join("");
}

/* ==========================================================================
   Article loader + renderer
   ========================================================================== */

function renderArticle(blog) {
    const bodyEl = document.getElementById("body");
    if (!bodyEl) return;

    const fmt = (blog.body_format || "").toLowerCase();
    const isTiptap = fmt === "tiptap" || (blog.body || "").trim().startsWith("[");

    if (isTiptap) {
        // Tiptap JSON renderer
        bodyEl.innerHTML = renderTiptapJSON(blog.body, { dropcap: true });
    } else {
        // Legacy plain text
        bodyEl.innerHTML = formatBodyLegacy(blog.body);
    }

    // Attach mention click handlers
    attachMentionClicks(bodyEl);
}

function attachMentionClicks(container) {
    if (!container) return;
    container.querySelectorAll(".mention-chip").forEach(chip => {
        chip.style.cursor = "pointer";
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
                        const isMe = token && (() => {
                            try {
                                const parsed = JSON.parse(atob(token.split(".")[1] || ""));
                                return Number(parsed?.sub || parsed?.user_id || parsed?.id) === Number(match.id);
                            } catch { return false; }
                        })();
                        window.location.href = isMe ? "/user" : `/profile/${match.id}`;
                    }
                }
            } catch (error) { /* ignore */ }
        });
    });
}

/* ==========================================================================
   Initialize
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function() {
    // The blog is already loaded by sep_blog.js and rendered via formatBody()
    // We need to hook in after that and re-render if it's Tiptap JSON

    const bodyEl = document.getElementById("body");
    if (!bodyEl) return;

    // Check if the current content looks like Tiptap JSON
    const currentContent = bodyEl.innerHTML.trim();
    const isLikelyJSON = currentContent.startsWith("[") || currentContent.startsWith("{");

    if (isLikelyJSON) {
        // Fetch fresh blog data to get body_format
        (async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_URL}/blog/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const blog = await res.json();
                    renderArticle(blog);
                }
            } catch (e) {
                console.warn("Could not re-fetch blog for rendering:", e);
            }
        })();
    }
});

// Expose for external use
window.renderTiptapJSON = renderTiptapJSON;
window.renderArticle = renderArticle;