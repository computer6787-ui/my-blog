/* ==========================================================================
   LUMORA EDITORIAL EDITOR — Tiptap writing canvas
   ==========================================================================
   Shared by /create-blog and /edit-blog. Determines its mode from the page's
   data-mode attribute ("create" vs "edit"). Owns:
     - Tiptap editor + Figure/Figcaption nodes
     - Compact formatting toolbar
     - Slash command menu
     - Cover image upload / crop / AI generation (Supabase Storage)
     - Word count + reading time
     - Write / Preview views
     - Save draft & Publish (POST/PUT to /blog)
   -------------------------------------------------------------------------- */

// Capture native Image constructor BEFORE Tiptap import shadows it
const NativeImage = window.Image;

import { Editor, Node } from "https://cdn.jsdelivr.net/npm/@tiptap/core@2.14.0/dist/index.js";
import StarterKit from "https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.14.0/dist/index.js";
import Underline from "https://cdn.jsdelivr.net/npm/@tiptap/extension-underline@2.14.0/dist/index.js";
import Link from "https://cdn.jsdelivr.net/npm/@tiptap/extension-link@2.14.0/dist/index.js";
import TiptapImage from "https://cdn.jsdelivr.net/npm/@tiptap/extension-image@2.14.0/dist/index.js";
import TextAlign from "https://cdn.jsdelivr.net/npm/@tiptap/extension-text-align@2.14.0/dist/index.js";
import Placeholder from "https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@2.14.0/dist/index.js";
import { showLoading, hideLoading, notify, confirmDialog, IMAGE_MODEL } from "./config.js?v=20260918";

const API_URL = "";

const MODE = document.querySelector(".editor-main")?.dataset?.mode || "create";
const BLOG_ID = MODE === "edit" ? String(window.location.pathname.split("/").pop() || "") : "";

/* ==========================================================================
   Figure + Figcaption — image blocks with editable captions
   ========================================================================== */
const Figure = Node.create({
    name: "figure",
    group: "block",
    content: "image figcaption?",
    inline: false,
    draggable: true,
    parseHTML() { return [{ tag: "figure" }]; },
    renderHTML({ HTMLAttributes }) { return ["figure", HTMLAttributes, 0]; },
    addAttributes() {
        return {
            width: { default: "normal" },
        };
    },
});

const FigureCaption = Node.create({
    name: "figcaption",
    content: "inline*",
    inline: false,
    defining: true,
    parseHTML() { return [{ tag: "figcaption" }]; },
    renderHTML() { return ["figcaption", 0]; },
    // Enter inside a caption should NOT try to exit the code-like node into a
    // dead boundary after the <figure>. Instead, insert a fresh paragraph right
    // after the figure and drop the cursor into it so writing can continue.
    addKeyboardShortcuts() {
        return {
            Enter: () => {
                const { state } = this.editor;
                const { $from } = state.selection;
                if (!this.editor.isActive("figcaption")) return false;

                // Walk up to the enclosing <figure>
                let captionDepth = $from.depth;
                while (captionDepth > 0 && $from.node(captionDepth).type.name !== "figcaption") {
                    captionDepth -= 1;
                }
                if (captionDepth === 0) return false;

                const figureDepth = captionDepth - 1;
                const figureStart = $from.before(figureDepth);
                const figureNode = state.doc.nodeAt(figureStart);
                if (!figureNode || figureNode.type.name !== "figure") return false;

                const figureEnd = figureStart + figureNode.nodeSize;
                this.editor.chain().focus().insertContentAt(figureEnd, { type: "paragraph" }).run();
                return true; // consume the keystroke so the default Enter handler never runs
            },
        };
    },
});

const FigureImage = Node.create({
    name: "figureImage",
    atom: true,
    group: "block",
    selectable: true,
    draggable: true,
    inline: false,
    parseHTML() { return [{ tag: "figure" }]; },
    addOptions() { return { HTMLAttributes: {} }; },
    addAttributes() {
        return {
            src: { default: null },
            alt: { default: null },
            width: { default: "normal" },
            caption: { default: "" },
        };
    },
    renderHTML({ HTMLAttributes }) {
        const { src, alt, width, caption } = HTMLAttributes;
        const fig = ["figure"];
        if (width && width !== "normal") fig.push({ "data-width": width });
        fig.push(["img", { src, alt: alt || "" }]);
        if (caption) fig.push(["figcaption", {}, caption]);
        return fig;
    },
});

/* --------------------------------------------------------------------------
   Theme detection + AI cover generation (carried over from legacy editor)
   -------------------------------------------------------------------------- */
const CONTENT_KEYWORDS = {
    tech: ["code", "programming", "software", "data", "algorithm", "web", "app", "developer", "python", "javascript", "database", "server", "api", "tech", "computer", "digital", "technology", "ai", "cyber"],
    life: ["life", "people", "human", "family", "friend", "love", "health", "happiness", "experience", "journey", "growth", "story", "moment", "memory", "nature", "travel", "adventure", "peace"],
    creative: ["art", "design", "creative", "music", "paint", "draw", "beautiful", "aesthetic", "craft", "create", "visual", "color", "inspire", "artistic"],
    ideas: ["idea", "think", "thought", "concept", "philosophy", "perspective", "vision", "dream", "possibility", "potential", "innovation", "future"],
    insights: ["insight", "learn", "knowledge", "wisdom", "understand", "realize", "discover", "lesson", "truth", "meaning", "purpose", "deep", "teach"],
    thoughts: ["think", "thought", "mind", "feel", "feeling", "emotion", "wonder", "question", "curious", "reflect", "ponder", "soul", "heart"],
    design: ["design", "ui", "ux", "interface", "layout", "visual", "user", "experience", "build", "pattern", "architecture", "minimal"],
};

function detectTheme(title, body) {
    const text = `${title} ${body}`.toLowerCase();
    const words = text.match(/\b\w+\b/g) || [];
    let bestTheme = "default";
    let bestScore = 0;
    for (const [theme, keywords] of Object.entries(CONTENT_KEYWORDS)) {
        const score = keywords.reduce((count, keyword) => count + ((text.match(new RegExp(`\\b${keyword}\\b`, "gi")) || []).length), 0);
        if (score > bestScore) { bestScore = score; bestTheme = theme; }
    }
    if (bestScore === 0) {
        if (words.length > 500) bestTheme = "insights";
        else if (words.length > 200) bestTheme = "thoughts";
        else bestTheme = "creative";
    }
    return bestTheme;
}

const STOPWORDS = new Set([
    "the", "and", "that", "for", "are", "was", "with", "this", "have", "from",
    "not", "but", "they", "you", "his", "her", "she", "will", "would", "there",
    "their", "what", "about", "which", "when", "who", "your", "more", "been",
    "were", "can", "out", "just", "than", "then", "them", "some", "into", "only",
    "over", "also", "after", "where", "how", "our", "because", "very", "really",
    "just", "like", "know", "get", "got", "one", "two", "many", "much", "every",
    "still", "even", "again", "its", "it's", "i'm", "i've", "isn't", "aren't",
]);

function extractContentKeywords(title, body, max = 6) {
    const plainText = `${title || ""} ${body || ""}`
        .replace(/<[^>]*>/g, " ")
        .replace(/[^a-zA-Z0-9\s'-]/g, " ")
        .toLowerCase();
    const wordCount = new Map();
    const words = plainText.match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
    for (const w of words) {
        if (STOPWORDS.has(w)) continue;
        wordCount.set(w, (wordCount.get(w) || 0) + 1);
    }
    return [...wordCount.entries()]
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
        .map(([w]) => w)
        .slice(0, max);
}

function hashString(str = "") {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function generateSmartCoverImage(title, body, customPrompt, useRandomSeed) {
    const contentKeywords = extractContentKeywords(title, body);
    const keywordsStr = contentKeywords.length ? contentKeywords.join(", ") : "beautiful aesthetic landscape";
    const cleanTitle = (title || "beautiful cover").replace(/[{}()]/g, "").slice(0, 60);
    const prompt = customPrompt
        ? customPrompt.slice(0, 300)
        : `editorial magazine cover photograph for an article titled "${cleanTitle}": ${keywordsStr}, photorealistic, natural lighting, strong composition, subtle cinematic photography, tasteful color grading, realistic textures, clean layout with calm negative space for a headline overlay, no text, no watermark, no excessive glow, no oversaturated colors, tonally natural premium editorial quality`;
    const seed = useRandomSeed
        ? Math.floor(Math.random() * 2147483647)
        : hashString(customPrompt ? customPrompt : `${cleanTitle} ${keywordsStr}`);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=630&seed=${seed}&nologo=true&model=${IMAGE_MODEL}`;
    return { url, query: prompt, theme: detectTheme(title, body) };
}

/* --------------------------------------------------------------------------
   Image tooling (reused for cover image + inline body images)
   -------------------------------------------------------------------------- */

function uploadImageToStorage(dataUrl) {
    const token = localStorage.getItem("token");
    if (!dataUrl || !dataUrl.startsWith("data:image/") || !token) {
        return Promise.resolve({ ok: false, error: "missing auth token or invalid image" });
    }
    return (async () => {
        try {
            const blob = await (await fetch(dataUrl)).blob();
            if (!blob || !blob.size) return { ok: false, error: "empty image" };
            const formData = new FormData();
            formData.append("file", blob, "cover.webp");
            const response = await fetch(`${API_URL}/blog/upload-image`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return { ok: false, error: err.detail || `Upload failed (HTTP ${response.status})` };
            }
            const data = await response.json();
            return { ok: true, url: data.url };
        } catch (error) {
            return { ok: false, error: (error && error.message) || "network error" };
        }
    })();
}

function createWebPDataUrl(file, quality = 0.72, maxWidth = 1600, maxHeight = 1200) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new NativeImage();
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
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to read image.")); };
        image.src = url;
    });
}

/* ==========================================================================
   DOM refs
   ========================================================================== */
let $ = (id) => document.getElementById(id);
const el = {
    topbarStatus: $("editor-topbar-status"),
    title: $("title"),
    subtitle: $("subtitle"),
    bylineName: $("byline-name"),
    bylineAvatar: $("byline-avatar"),
    bylineDate: $("byline-date"),
    body: $("editor-body"),
    preview: $("editor-preview"),
    toolbar: $("editor-toolbar"),
    category: $("category"),
    imageUrl: $("image_url"),
    deviceImage: $("device_image"),
    uploadBtn: $("btn-upload-img"),
    adjustBtn: $("btn-adjust-img"),
    surpriseBtn: $("btn-surprise-img"),
    clearImgBtn: $("btn-clear-img"),
    aiCoverPrompt: $("ai_cover_prompt"),
    coverPreview: $("cover-preview"),
    coverPreviewImg: $("cover-preview-img"),
    coverPlaceholder: $("cover-preview-placeholder"),
    cropModal: $("image_editor_modal"),
    cropStage: $("crop_stage"),
    cropImg: $("crop_image"),
    cropZoom: $("crop_zoom"),
    cropX: $("crop_x"),
    cropY: $("crop_y"),
    zoomValue: $("zoom_value"),
    closeCrop: $("close_crop_editor"),
    cancelCrop: $("cancel_crop_editor"),
    applyCrop: $("apply_crop_editor"),
    publishBtn: $("btn-publish"),
    saveDraftBtn: $("btn-save-draft"),
    wordCount: $("editor-word-count"),
    viewWrite: $("view-write"),
    viewPreview: $("view-preview"),
    cmdMenu: $("editor-command-menu"),
    inlineImageInput: $("inline_image_input"),
};

/* ==========================================================================
   Editor construction
   ========================================================================== */
let editor = null;

function makeEditor() {
    editor = new Editor({
        element: el.body,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            Link,
            TiptapImage,
            Figure,
            FigureCaption,
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Placeholder.configure({
                placeholder: "Write your story...",
            }),
        ].filter(Boolean),
        content: "",
        editorProps: {
            attributes: { class: "article-prose", spellcheck: "true" },
        },
        onUpdate: () => {
            updateStats();
            onEditorChange();
        },
        onSelectionUpdate: () => onEditorChange(),
        onTransaction: () => onEditorChange(),
        onCreate: () => onEditorChange(),
    });
}

/* ==========================================================================
   Stats + byline
   ========================================================================== */
function updateStats() {
    const text = editor ? editor.getText() : "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.ceil(words / 180));
    if (el.wordCount) el.wordCount.textContent = `${words.toLocaleString()} words · ${minutes} min read`;
}

/* ==========================================================================
   Toolbar wiring
   ========================================================================== */
const ACTIVE_CMDS = ["bold", "italic", "underline", "strike", "bulletList", "orderedList", "blockquote"];

function refreshToolbar() {
    if (!editor) return;
    document.querySelectorAll("#editor-toolbar [data-cmd]").forEach((btn) => {
        const cmd = btn.dataset.cmd;
        const level = btn.dataset.level ? Number(btn.dataset.level) : null;
        let active = false;
        if (cmd === "heading" && level) active = editor.isActive("heading", { level });
        else if (ACTIVE_CMDS.includes(cmd)) active = editor.isActive(cmd);
        else if (cmd === "link") active = editor.isActive("link");
        else if (cmd === "undo") btn.disabled = !editor.can().undo();
        else if (cmd === "redo") btn.disabled = !editor.can().redo();
        if (cmd === "undo" || cmd === "redo") return;
        btn.classList.toggle("is-active", !!active);
    });
    // Format select — custom dropdown
    const _fmtTrig = document.getElementById("editor-format-trigger");
    const _fmtMnu = document.getElementById("editor-format-menu");
    if (_fmtTrig && _fmtMnu) {
        const activeLevel = [1, 2, 3].find((l) => editor.isActive("heading", { level: l }));
        const activeValue = activeLevel ? `h${activeLevel}` : (editor.isActive("bulletList") || editor.isActive("orderedList") ? "list" : "p");
        _fmtMnu.querySelectorAll(".format-select-option").forEach((opt) => {
            const isActive = opt.dataset.value === activeValue;
            opt.classList.toggle("is-active", isActive);
            opt.setAttribute("aria-selected", String(isActive));
        });
        const activeOpt = _fmtMnu.querySelector(`.format-select-option[data-value="${activeValue}"]`);
        if (activeOpt) {
            const lbl = _fmtTrig.querySelector(".format-select-label");
            if (lbl) lbl.textContent = activeOpt.textContent;
        }
    }
}

function onEditorChange() {
    if (!editor) return;
    refreshToolbar();
}

function runCmd(btn) {
    if (!editor) return;
    const cmd = btn.dataset.cmd;
    const level = btn.dataset.level ? Number(btn.dataset.level) : null;
    const chain = editor.chain().focus();
    switch (cmd) {
        case "bold": chain.toggleBold().run(); break;
        case "italic": chain.toggleItalic().run(); break;
        case "underline": chain.toggleUnderline().run(); break;
        case "strike": chain.toggleStrike().run(); break;
        case "heading": chain.toggleHeading({ level }).run(); break;
        case "paragraph": chain.setParagraph().run(); break;
        case "bulletList": chain.toggleBulletList().run(); break;
        case "orderedList": chain.toggleOrderedList().run(); break;
        case "blockquote": chain.toggleBlockquote().run(); break;
        case "hr": chain.setHorizontalRule().run(); break;
        case "alignLeft": chain.setTextAlign("left").run(); break;
        case "alignCenter": chain.setTextAlign("center").run(); break;
        case "alignRight": chain.setTextAlign("right").run(); break;
        case "undo": chain.undo().run(); break;
        case "redo": chain.redo().run(); break;
        case "link": promptForLink(); break;
        case "image": pickAndInsertImage(); break;
    }
}

/* --- Link dialog (themed replacement for window.prompt) --- */
let linkDialogEl = null, linkApplyBtn, linkCancelBtn;

function buildLinkDialog() {
    linkDialogEl = document.createElement("div");
    linkDialogEl.className = "link-dialog-overlay hidden";
    linkDialogEl.innerHTML = `
      <div class="link-dialog-panel">
        <h3>Insert link</h3>
        <input type="url" class="link-dialog-input" placeholder="https://example.com" autocomplete="off" />
        <div class="link-dialog-actions">
          <button type="button" class="btn-link-remove hidden" data-action="remove">Remove link</button>
          <button type="button" class="btn-cancel" data-action="cancel">Cancel</button>
          <button type="button" class="publish-button" data-action="apply">Apply</button>
        </div>
      </div>`;
    document.body.appendChild(linkDialogEl);
    linkApplyBtn  = linkDialogEl.querySelector('[data-action="apply"]');
    linkCancelBtn = linkDialogEl.querySelector('[data-action="cancel"]');
}

function promptForLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link");
    const href = previous.href || "";
    const isEdit = !!href;

    if (!linkDialogEl) buildLinkDialog();

    const input     = linkDialogEl.querySelector(".link-dialog-input");
    const removeBtn = linkDialogEl.querySelector(".btn-link-remove");
    const title     = linkDialogEl.querySelector("h3");

    title.textContent = isEdit ? "Edit link" : "Insert link";
    input.value = href;
    removeBtn.classList.toggle("hidden", !isEdit);
    linkDialogEl.classList.remove("hidden");
    setTimeout(() => { input.focus(); input.select(); }, 50);

    /* ---- wiring (rebuilt each open to avoid stale closures) ---- */
    function close()  { linkDialogEl.classList.add("hidden"); teardown(); }
    function teardown() {
        input.removeEventListener("keydown", onKey);
        linkApplyBtn.removeEventListener("click", apply);
        linkCancelBtn.removeEventListener("click", cancel);
        removeBtn.removeEventListener("click", remove);
        linkDialogEl.removeEventListener("click", onOverlay);
    }
    function onKey(e)  { if (e.key === "Enter") { e.preventDefault(); apply(); } if (e.key === "Escape") cancel(); }
    function onOverlay(e) { if (e.target === linkDialogEl) cancel(); }

    function apply() {
        const raw = input.value.trim();
        close();
        if (raw === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
        let clean = raw;
        if (!/^https?:\/\//i.test(clean) && !/^mailto:/i.test(clean)) clean = `https://${clean}`;
        editor.chain().focus().extendMarkRange("link").setLink({ href: clean, target: "_blank", rel: "noopener" }).run();
    }

    function remove() { close(); editor.chain().focus().extendMarkRange("link").unsetLink().run(); }
    function cancel() { close(); }

    input.addEventListener("keydown", onKey);
    linkApplyBtn.addEventListener("click", apply);
    linkCancelBtn.addEventListener("click", cancel);
    removeBtn.addEventListener("click", remove);
    linkDialogEl.addEventListener("click", onOverlay);
}

/* Inline images from the toolbar: upload then insert a figure w/ caption */
function pickAndInsertImage() {
    if (!el.inlineImageInput) return;
    el.inlineImageInput.value = "";
    el.inlineImageInput.click();
}

// Set up the inline image input handler (separate from the cover image input)
if (el.inlineImageInput) {
    el.inlineImageInput.addEventListener("change", async () => {
        const file = el.inlineImageInput.files && el.inlineImageInput.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            notify({ type: "warning", title: "Invalid file", text: "Please choose an image file." });
            return;
        }
        try {
            const dataUrl = await createWebPDataUrl(file, 0.78, 2000, 1500);
            const up = await uploadImageToStorage(dataUrl);
            const src = up.ok ? up.url : dataUrl;
            if (!up.ok) {
                console.warn("[inline-image]", up.error);
                notify({ type: "warning", title: "Cloud Upload Failed", text: "Image embedded from the browser. Cloud storage was unavailable." });
            }
            editor.chain().focus().insertContent({
                type: "figure",
                attrs: { width: "normal" },
                content: [
                    { type: "image", attrs: { src, alt: file.name || "" } },
                    { type: "figcaption", content: "" },
                ],
            }).run();
        } catch (error) {
            console.error(error);
            notify({ type: "error", title: "Image Error", text: "This image could not be processed. Please try another one." });
        }
    });
}

/* ==========================================================================
   Slash command menu
   ========================================================================== */
const COMMANDS = [
    { id: "h1", label: "Heading 1", icon: "H1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: "h2", label: "Heading 2", icon: "H2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "h3", label: "Heading 3", icon: "H3", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: "quote", label: "Quote", icon: "“", action: () => editor.chain().focus().toggleBlockquote().run() },
    { id: "list", label: "Bullet list", icon: "•", action: () => editor.chain().focus().toggleBulletList().run() },
    { id: "olist", label: "Ordered list", icon: "1.", action: () => editor.chain().focus().toggleOrderedList().run() },
    { id: "divider", label: "Divider", icon: "—", action: () => editor.chain().focus().setHorizontalRule().run() },
    { id: "image", label: "Image", icon: "🖼", action: () => pickAndInsertImage() },
    { id: "paragraph", label: "Paragraph", icon: "¶", action: () => editor.chain().focus().setParagraph().run() },
];

let cmdState = null; // { start: number, end: number, query: string }
let cmdSelection = 0;

function showCommandMenu(query) {
    const menu = el.cmdMenu;
    if (!menu) return;
    const filtered = COMMANDS.filter((c) => c.label.toLowerCase().startsWith(query.toLowerCase()));
    if (filtered.length === 0) { hideCommandMenu(); return; }
    cmdSelection = 0;
    menu.innerHTML = "";
    filtered.forEach((c, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "editor-command-menu-item";
        btn.dataset.index = String(i);
        btn.dataset.id = c.id;
        btn.innerHTML = `<span class="cmd-icon">${c.icon}</span><span class="cmd-label">${c.label}</span>`;
        btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); runCommandMenu(c); });
        menu.appendChild(btn);
    });
    renderCommandSelection(filtered);
    menu.classList.remove("hidden");

    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = 260;
    let left = coords.left;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    const spaceBelow = window.innerHeight - coords.bottom;
    const top = spaceBelow > menuRect.height + 80 ? coords.bottom + 8 : coords.top - menuRect.height - 8;
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.dataset.items = String(filtered.length);
    window.__cmdList = filtered;
}

function renderCommandSelection(filtered) {
    const list = filtered || window.__cmdList || [];
    (el.cmdMenu || []).querySelectorAll(".editor-command-menu-item").forEach((btn, i) => {
        btn.classList.toggle("is-selected", i === cmdSelection);
    });
}

function hideCommandMenu() {
    if (el.cmdMenu && !el.cmdMenu.classList.contains("hidden")) el.cmdMenu.classList.add("hidden");
    cmdState = null;
    window.__cmdList = null;
}

function runCommandMenu(cmd) {
    if (!editor || !cmdState) return;
    editor.chain().focus().deleteRange({ from: cmdState.start, to: cmdState.end }).run();
    hideCommandMenu();
    cmd.action();
    editor.chain().focus().run();
}

function handleEditorTransaction() {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    if (!selection || !selection.$from) { hideCommandMenu(); return; }
    const $from = selection.$from;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
    const match = textBefore.match(/(^|\s)\/(\w*)$/);
    if (match) {
        const slashStart = $from.parentOffset - match[0].length;
        const absStart = $from.pos - $from.parentOffset + slashStart;
        const absEnd = $from.pos;
        cmdState = { start: absStart, end: absEnd, query: match[2] };
        showCommandMenu(match[2]);
    } else {
        hideCommandMenu();
    }
}

/* ==========================================================================
   Cover image flow (crop + AI + Supabase)
   ========================================================================== */
let pendingImageSource = "";
let pendingImageFile = null;

/* ==========================================================================
   AI cover generation loader — fills the cover preview slot + button lock
   ========================================================================== */
let aiCoverGenerating = false;

function showCoverLoader(promptText, btn) {
    aiCoverGenerating = true;

    // Block accidental clicks and make the button say "Generating…"
    if (btn) {
        btn.dataset.original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "🎲 Generating…";
    }

    const box = document.getElementById("ai-cover-loader");
    if (!box) return;
    const promptTextEl = document.getElementById("ai-loader-prompt-text");
    if (promptTextEl) promptTextEl.textContent = promptText || "";

    // The loader takes the preview/placeholder slot while the image renders,
    // so the animation appears exactly where the cover preview will be.
    if (el.coverPreview) el.coverPreview.classList.add("hidden");
    if (el.coverPlaceholder) el.coverPlaceholder.classList.add("hidden");
    box.classList.remove("hidden");
}

function hideCoverLoader() {
    aiCoverGenerating = false;
    if (el.surpriseBtn && el.surpriseBtn.dataset.original) {
        el.surpriseBtn.disabled = false;
        el.surpriseBtn.textContent = el.surpriseBtn.dataset.original;
        delete el.surpriseBtn.dataset.original;
    }
    const box = document.getElementById("ai-cover-loader");
    if (box) box.classList.add("hidden");
}

function updateCoverPreview(url) {
    const clean = (url || "").trim();
    if (clean) {
        el.coverPreviewImg.src = clean;
        el.coverPreviewImg.onload = () => {
            hideCoverLoader();
            if (el.coverPreview) { el.coverPreview.classList.remove("hidden"); }
            if (el.coverPlaceholder) el.coverPlaceholder.classList.add("hidden");
            if (el.clearImgBtn) el.clearImgBtn.classList.remove("hidden");
            if (el.adjustBtn && clean.startsWith("data:")) el.adjustBtn.classList.remove("hidden");
            else if (el.adjustBtn) el.adjustBtn.classList.add("hidden");
        };
        el.coverPreviewImg.onerror = () => {
            if (aiCoverGenerating) {
                notify({ type: "warning", title: "Couldn't generate cover", text: "The AI cover failed on its first attempt. Try the Surprise button again or upload a photo." });
            }
            if (el.coverPreview) el.coverPreview.classList.add("hidden");
            if (el.coverPlaceholder) el.coverPlaceholder.classList.remove("hidden");
            hideCoverLoader();
        };
    } else {
        if (el.coverPreview) el.coverPreview.classList.add("hidden");
        if (el.coverPlaceholder) el.coverPlaceholder.classList.remove("hidden");
        if (el.clearImgBtn) el.clearImgBtn.classList.add("hidden");
        if (el.adjustBtn) el.adjustBtn.classList.add("hidden");
    }
}

function openCropEditor(source) {
    if (!el.cropModal) return;
    pendingImageSource = source || pendingImageSource;
    el.cropImg.src = pendingImageSource;
    el.cropImg.onload = () => {
        el.cropZoom.value = 1;
        el.cropX.value = 50;
        el.cropY.value = 50;
        updateCropPreview();
        el.cropModal.classList.remove("hidden");
        el.cropModal.setAttribute("aria-hidden", "false");
    };
}
function closeCropEditorDialog() {
    if (!el.cropModal) return;
    el.cropModal.classList.add("hidden");
    el.cropModal.setAttribute("aria-hidden", "true");
}
function updateCropPreview() {
    if (!el.cropImg || !el.cropZoom || !el.cropX || !el.cropY || !el.zoomValue) return;
    const zoom = Number(el.cropZoom.value);
    const xPercent = Number(el.cropX.value) / 100;
    const yPercent = Number(el.cropY.value) / 100;
    const maxShift = Math.max(0, (zoom - 1) * 60);
    const offsetX = (xPercent - 0.5) * 2 * maxShift;
    const offsetY = (yPercent - 0.5) * 2 * maxShift;
    el.cropImg.style.transform = `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`;
    el.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
}
function clampCropValue(value, min, max) { return Math.min(Math.max(value, min), max); }

function attachCropHandlers() {
    if (!el.cropStage) return;
    const dragState = { pointerId: null, startX: 0, startY: 0, originX: 50, originY: 50 };
    const setCropFromPointer = (clientX, clientY) => {
        const dx = clientX - dragState.startX;
        const dy = clientY - dragState.startY;
        const nextX = clampCropValue(dragState.originX + (dx / el.cropStage.clientWidth) * 100, 0, 100);
        const nextY = clampCropValue(dragState.originY + (dy / el.cropStage.clientHeight) * 100, 0, 100);
        el.cropX.value = String(nextX);
        el.cropY.value = String(nextY);
        updateCropPreview();
    };
    el.cropStage.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        dragState.pointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
        dragState.originX = Number(el.cropX.value);
        dragState.originY = Number(el.cropY.value);
        el.cropStage.setPointerCapture(event.pointerId);
        el.cropStage.classList.add("is-dragging");
    });
    el.cropStage.addEventListener("pointermove", (event) => {
        if (dragState.pointerId !== event.pointerId) return;
        setCropFromPointer(event.clientX, event.clientY);
    });
    const endDrag = (event) => {
        if (dragState.pointerId !== null && event.pointerId === dragState.pointerId) {
            dragState.pointerId = null;
            el.cropStage.classList.remove("is-dragging");
        }
    };
    el.cropStage.addEventListener("pointerup", endDrag);
    el.cropStage.addEventListener("pointercancel", endDrag);
    el.cropStage.addEventListener("pointerleave", endDrag);
    el.cropStage.addEventListener("wheel", (event) => {
        event.preventDefault();
        const currentZoom = Number(el.cropZoom.value);
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        el.cropZoom.value = String(clampCropValue(currentZoom + delta, 1, 2.7));
        updateCropPreview();
    }, { passive: false });
}

async function processCoverImage(file) {
    if (!file || !file.type.startsWith("image/")) {
        notify({ type: "warning", title: "Invalid file", text: "Please choose an image file." });
        return;
    }
    try {
        const webpDataUrl = await createWebPDataUrl(file, 0.72, 1600, 1200);
        pendingImageSource = webpDataUrl;
        pendingImageFile = file;
        if (el.imageUrl) el.imageUrl.value = webpDataUrl;
        updateCoverPreview(webpDataUrl);
        openCropEditor(webpDataUrl);
    } catch (error) {
        console.error(error);
        notify({ type: "error", title: "Image Error", text: "This image could not be processed. Please try another one." });
    }
}

function resetCoverState() {
    pendingImageSource = "";
    pendingImageFile = null;
    if (el.imageUrl) el.imageUrl.value = "";
    if (el.deviceImage) el.deviceImage.value = "";
    updateCoverPreview("");
}

function wireCoverFlow() {
    if (el.uploadBtn && el.deviceImage) {
        el.uploadBtn.addEventListener("click", () => el.deviceImage.click());
        el.deviceImage.addEventListener("change", () => {
            const file = el.deviceImage.files && el.deviceImage.files[0];
            if (file) processCoverImage(file);
        });
    }
    if (el.adjustBtn) el.adjustBtn.addEventListener("click", () => openCropEditor(pendingImageSource));
    if (el.clearImgBtn) el.clearImgBtn.addEventListener("click", resetCoverState);
    if (el.surpriseBtn) {
        el.surpriseBtn.addEventListener("click", () => {
            if (aiCoverGenerating) return; // block accidental double-clicks
            const title = (el.title && el.title.value) || "";
            const body = editor ? editor.getText() : "";
            const customPrompt = el.aiCoverPrompt ? el.aiCoverPrompt.value.trim() : "";
            const cover = generateSmartCoverImage(title, body, customPrompt || undefined, true);
            if (el.imageUrl) el.imageUrl.value = cover.url;
            showCoverLoader(cover.query, el.surpriseBtn);
            updateCoverPreview(cover.url);
        });
    }
    if (el.cropZoom) el.cropZoom.addEventListener("input", updateCropPreview);
    if (el.cropX) el.cropX.addEventListener("input", updateCropPreview);
    if (el.cropY) el.cropY.addEventListener("input", updateCropPreview);
    if (el.closeCrop) el.closeCrop.addEventListener("click", closeCropEditorDialog);
    if (el.cancelCrop) el.cancelCrop.addEventListener("click", closeCropEditorDialog);
    if (el.applyCrop) {
        el.applyCrop.addEventListener("click", async () => {
            if (!pendingImageSource) { closeCropEditorDialog(); return; }
            try {
                const sourceImage = new Image();
                sourceImage.onload = async () => {
                    const cropCanvas = document.createElement("canvas");
                    cropCanvas.width = 1200;
                    cropCanvas.height = 675;
                    const context = cropCanvas.getContext("2d");
                    const zoom = Number(el.cropZoom.value);
                    const centerX = Number(el.cropX.value) / 100;
                    const centerY = Number(el.cropY.value) / 100;
                    const cropWidth = sourceImage.width / zoom;
                    const cropHeight = sourceImage.height / zoom;
                    const sourceX = Math.min(Math.max((sourceImage.width - cropWidth) * centerX, 0), Math.max(sourceImage.width - cropWidth, 0));
                    const sourceY = Math.min(Math.max((sourceImage.height - cropHeight) * centerY, 0), Math.max(sourceImage.height - cropHeight, 0));
                    context.fillStyle = "#1f1b2e";
                    context.fillRect(0, 0, 1200, 675);
                    context.drawImage(sourceImage, sourceX, sourceY, cropWidth, cropHeight, 0, 0, 1200, 675);
                    const croppedWebp = cropCanvas.toDataURL("image/webp", 0.74);
                    pendingImageSource = croppedWebp;
                    updateCoverPreview(croppedWebp);
                    const up = await uploadImageToStorage(croppedWebp);
                    if (up.ok) {
                        if (el.imageUrl) el.imageUrl.value = up.url;
                    } else {
                        if (el.imageUrl) el.imageUrl.value = croppedWebp;
                        console.warn("[cover-upload]", up.error);
                        notify({ type: "warning", title: "Cloud Upload Failed", text: "Your cover image will be saved inline. Cloud storage is unavailable right now." });
                    }
                    closeCropEditorDialog();
                };
                sourceImage.src = pendingImageSource;
            } catch (error) {
                console.error(error);
                notify({ type: "error", title: "Crop Error", text: "The crop could not be applied. Please try again." });
            }
        });
    }
}

/* ==========================================================================
   Save / Publish
   ========================================================================== */
async function ensureCoverUploaded() {
    let url = el.imageUrl ? (el.imageUrl.value || "").trim() : "";
    if (url && url.startsWith("data:image/")) {
        const up = await uploadImageToStorage(url);
        if (up.ok) {
            url = up.url;
            if (el.imageUrl) el.imageUrl.value = up.url;
        } else {
            console.warn("[cover-upload retry]", up.error);
        }
    }
    return url || null;
}

function getPayload(published) {
    const title = (el.title && el.title.value.trim()) || "";
    const subtitle = (el.subtitle && el.subtitle.value.trim()) || null;
    const body = editor ? JSON.stringify(editor.getJSON()) : "";
    const image_url = el.imageUrl ? (el.imageUrl.value || "").trim() || null : null;
    const category = el.category ? (el.category.value || "").trim() || null : null;
    return { title, subtitle, body, body_format: "tiptap", image_url, category, published };
}

async function submitArticle(published) {
    const token = localStorage.getItem("token");
    if (!token) {
        await notify({ type: "warning", title: "Login Required", text: "Please log in to save your article.", onClick: () => { window.location.href = "/login"; } });
        window.location.href = "/login";
        return false;
    }
    const title = (el.title && el.title.value.trim()) || "";
    if (published && !title) {
        notify({ type: "warning", title: "Missing Title", text: "Please give your article a title." });
        if (el.title) el.title.focus();
        return false;
    }

    showLoading(published ? "Publishing your article..." : "Saving draft...");
    try {
        const hasCover = el.imageUrl && (el.imageUrl.value || "").trim();
        let image_url = null;
        if (hasCover) image_url = await ensureCoverUploaded();
        else if (published) {
            // Auto-generate a deterministic editorial cover when none supplied.
            const cover = generateSmartCoverImage(title, editor ? editor.getText() : "", el.aiCoverPrompt ? el.aiCoverPrompt.value.trim() : "");
            image_url = cover.url;
            if (el.imageUrl) el.imageUrl.value = cover.url;
            showCoverLoader(cover.query);
            updateCoverPreview(cover.url);
        }

        const payload = {
            title,
            subtitle: (el.subtitle && el.subtitle.value.trim()) || null,
            body: editor ? JSON.stringify(editor.getJSON()) : "",
            body_format: "tiptap",
            image_url,
            category: el.category ? (el.category.value || "").trim() || null : null,
            published,
        };

        const isEdit = MODE === "edit";
        const response = await fetch(`${API_URL}/blog/${isEdit ? BLOG_ID + "" : ""}`, {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
        });
        hideLoading();

        if (response.ok) {
            await notify({ type: "success", title: published ? "Published!" : "Draft saved", text: published ? "Your article is now live." : "Your draft has been saved." });
            // Edit → go to the published blog page; new publish → go to public blog listing
            if (published) {
                window.location.href = isEdit ? `/blogs/${BLOG_ID}` : "/blog";
            } else {
                window.location.href = "/user";
            }
            return true;
        }
        if (response.status === 401) {
            localStorage.removeItem("token");
            await notify({ type: "warning", title: "Session Expired", text: "Please log in again.", onClick: () => { window.location.href = "/login"; } });
            window.location.href = "/login";
            return false;
        }
        const err = await response.json().catch(() => ({}));
        notify({ type: "error", title: "Save Failed", text: err.detail || "Unable to save the article. Please try again." });
        return false;
    } catch (error) {
        hideLoading();
        console.error(error);
        notify({ type: "error", title: "Connection Error", text: "Could not connect to the server. Please try again." });
        return false;
    }
}

/* ==========================================================================
   Byline + current user
   ========================================================================== */
async function loadByline() {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/user/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
            const user = await res.json();
            if (el.bylineName) el.bylineName.textContent = user.name || "Lumora Writer";
            if (el.bylineAvatar) {
                if (user.profile_picture_url) {
                    el.bylineAvatar.innerHTML = `<img src="${user.profile_picture_url}" alt="">`;
                } else {
                    el.bylineAvatar.textContent = (user.name || "L").trim()[0].toUpperCase();
                }
            }
        }
    } catch (error) { /* non-fatal */ }
}

/* ==========================================================================
   View toggle: Write / Preview
   ========================================================================== */
function setupViews() {
    if (!el.viewWrite || !el.viewPreview) return;
    const setMode = (mode, btn) => {
        el.viewWrite.classList.toggle("is-active", mode === "write");
        el.viewPreview.classList.toggle("is-active", mode === "preview");
        if (mode === "write") {
            el.body.classList.remove("hidden");
            el.preview.classList.add("hidden");
            el.toolbar.classList.remove("hidden");
        } else {
            el.body.classList.add("hidden");
            el.preview.classList.remove("hidden");
            el.toolbar.classList.add("hidden");
            renderPreview();
        }
        if (btn && el.topbarStatus) el.topbarStatus.textContent = mode === "write" ? "Write" : "Preview";
    };
    el.viewWrite.addEventListener("click", () => setMode("write", el.viewWrite));
    el.viewPreview.addEventListener("click", () => setMode("preview", el.viewPreview));
}

function renderPreview() {
    if (!editor || !el.preview) return;
    const json = editor.getJSON();
    const html = renderTiptapToHTML(json, { dropcap: true });
    el.preview.innerHTML = html;
    // Ensure preview inherits all editorial styles (lists, hr, images, etc.)
    // by carrying the same prose class the reader page uses.
    el.preview.classList.add("article-prose");
}

/* Simple JSON→HTML renderer for the editor preview (mirrors reader.js) */
function renderTiptapToHTML(json, opts = {}) {
    if (!json || !json.content) return "";
    let html = "";
    const wrapText = (node) => {
        let text = node.text || "";
        let marks = (node.marks || []).slice().sort((a, b) => (a.type === "link" ? 1 : 0) - (b.type === "link" ? 1 : 0));
        text = escapeHtml(text || "");
        for (const mark of marks) {
            if (mark.type === "bold") text = `<strong>${text}</strong>`;
            else if (mark.type === "italic") text = `<em>${text}</em>`;
            else if (mark.type === "underline") text = `<u>${text}</u>`;
            else if (mark.type === "strike") text = `<s>${text}</s>`;
            else if (mark.type === "code") text = `<code>${text}</code>`;
            else if (mark.type === "link") text = `<a href="${escapeHtml(mark.attrs && mark.attrs.href) || "#"}"${mark.attrs && mark.attrs.target ? ` target="${mark.attrs.target}"` : ""} rel="noopener">${text}</a>`;
        }
        return text;
    };
    const renderInline = (node) => {
        if (node.type === "text") return wrapText(node);
        if (node.content) return node.content.map(renderInline).join("");
        return "";
    };
    for (const node of json.content) {
        switch (node.type) {
            case "paragraph":
                html += `<p${node.attrs && node.attrs.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : ""}>${(node.content || []).map(renderInline).join("")}</p>`;
                break;
            case "heading": {
                const level = node.attrs && node.attrs.level ? node.attrs.level : 2;
                html += `<h${level}>${(node.content || []).map(renderInline).join("")}</h${level}>`;
                break;
            }
            case "bulletList":
                html += `<ul>${(node.content || []).map((li) => `<li>${(li.content || []).map(renderInline).join("")}</li>`).join("")}</ul>`;
                break;
            case "orderedList":
                html += `<ol>${(node.content || []).map((li) => `<li>${(li.content || []).map(renderInline).join("")}</li>`).join("")}</ol>`;
                break;
            case "blockquote":
                html += `<blockquote>${(node.content || []).map((p) => `<p>${(p.content || []).map(renderInline).join("")}</p>`).join("")}</blockquote>`;
                break;
            case "horizontalRule": html += `<hr>`; break;
            case "image": {
                const src = node.attrs && node.attrs.src;
                html += `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml((node.attrs && node.attrs.alt) || "")}" loading="lazy"></figure>`;
                break;
            }
            case "figure": {
                const width = node.attrs && node.attrs.width === "wide" ? ' data-width="wide"' : "";
                const cap = node.content ? findNode(node, "figcaption") : null;
                const img = node.content ? findNode(node, "image") : null;
                const imgSrc = img && img.attrs && img.attrs.src;
                html += `<figure${width}><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml((img && img.attrs && img.attrs.alt) || "")}" loading="lazy">${cap ? `<figcaption>${(cap.content || []).map(renderInline).join("")}</figcaption>` : ""}</figure>`;
                break;
            }
            default:
                if (node.content) {
                    const parsed = renderTiptapToHTML(node, {});
                    if (parsed) html += parsed;
                }
        }
    }
    if (opts.dropcap) {
        return `<div class="has-dropcap">${html}</div>`;
    }
    return html;
}

function findNode(node, type) {
    if (!node.content) return null;
    for (const child of node.content) {
        if (child.type === type) return child;
        if (child.content) {
            const found = findNode(child, type);
            if (found) return found;
        }
    }
    return null;
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/* ==========================================================================
   Edit mode — load existing article
   ========================================================================== */
async function loadExisting() {
    const token = localStorage.getItem("token");
    if (!token) return;
    showLoading("Loading article...");
    try {
        const res = await fetch(`${API_URL}/blog/${BLOG_ID}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            hideLoading();
            await notify({ type: "error", title: "Article Not Found", text: "This article could not be loaded." });
            window.location.href = "/user";
            return;
        }
        const blog = await res.json();
        if (el.title) el.title.value = blog.title || "";
        if (el.subtitle) el.subtitle.value = blog.subtitle || "";
        if (el.category) el.category.value = blog.category || "";
        if (el.bylineName) el.bylineName.textContent = blog.creator?.name || "Lumora Writer";
        if (el.bylineDate) {
            el.bylineDate.textContent = blog.created_at ? formatEditorDate(blog.created_at) : "";
        }

        const fmt = (blog.body_format || "").toLowerCase();
        if ((fmt === "tiptap" || String(blog.body || "").trim().startsWith("[")) && editor) {
            try {
                editor.commands.setContent(JSON.parse(blog.body));
            } catch (e) {
                console.warn("Failed to parse rich content, falling back to text", e);
                editor.commands.setContent(blog.body || "");
            }
        } else if (editor) {
            editor.commands.setContent(blog.body || "");
        }

        if (blog.image_url && el.imageUrl) {
            el.imageUrl.value = blog.image_url;
            updateCoverPreview(blog.image_url);
        }
        updateStats();
    } catch (error) {
        console.error(error);
        notify({ type: "error", title: "Connection Error", text: "Could not load the article right now." });
    } finally {
        hideLoading();
    }
}

function formatEditorDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

/* ==========================================================================
   Init
   ========================================================================== */
function boot() {
    if (!el.body) return;

    makeEditor();

    // Remove the stray placeholder var wiring mistake as guard
    setupToolbar();
    setupViews();
    wireCoverFlow();
    loadByline();
    attachCropHandlers();

    if (el.topbarStatus) el.topbarStatus.textContent = "Write";

    if (el.publishBtn) el.publishBtn.addEventListener("click", () => submitArticle(true));
    if (el.saveDraftBtn) el.saveDraftBtn.addEventListener("click", () => submitArticle(false));

    if (el.title) {
        el.title.addEventListener("input", () => {
            if (el.topbarStatus) el.topbarStatus.textContent = el.title.value.trim() ? el.title.value.trim().slice(0, 40) : "Write";
        });
    }

    if (MODE === "edit" && BLOG_ID) loadExisting();
    updateStats();
}

function setupToolbar() {
    document.querySelectorAll("#editor-toolbar [data-cmd]").forEach((btn) => {
        btn.addEventListener("click", () => runCmd(btn));
    });

    /* --- Custom format dropdown (replaces native <select>) --- */
    const fmtTrigger = document.getElementById("editor-format-trigger");
    const fmtMenu = document.getElementById("editor-format-menu");
    if (fmtTrigger && fmtMenu) {
        // Move menu to body so no ancestor overflow can clip it
        document.body.appendChild(fmtMenu);

        function openFormatMenu() {
            fmtMenu.classList.remove("hidden");
            fmtTrigger.setAttribute("aria-expanded", "true");
            // Position relative to trigger
            const r = fmtTrigger.getBoundingClientRect();
            fmtMenu.style.position = "fixed";
            fmtMenu.style.top = (r.bottom + 4) + "px";
            fmtMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 180)) + "px";
        }

        function closeFormatMenu() {
            fmtMenu.classList.add("hidden");
            fmtMenu.style.position = "";
            fmtMenu.style.top = "";
            fmtMenu.style.left = "";
            fmtTrigger.setAttribute("aria-expanded", "false");
        }

        // Toggle on trigger click
        fmtTrigger.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (!fmtMenu.classList.contains("hidden")) {
                closeFormatMenu();
            } else {
                openFormatMenu();
            }
        });

        // Option selection
        var fmtOptions = fmtMenu.querySelectorAll(".format-select-option");
        for (var i = 0; i < fmtOptions.length; i++) {
            (function (opt) {
                opt.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!editor) return;
                    var v = opt.getAttribute("data-value");
                    if (v === "p") editor.chain().focus().setParagraph().run();
                    else if (v === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
                    else if (v === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
                    else if (v === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
                    closeFormatMenu();
                });
            })(fmtOptions[i]);
        }

        // Close on outside click
        document.addEventListener("click", function (e) {
            if (!fmtMenu.classList.contains("hidden")) {
                if (!fmtMenu.contains(e.target) && e.target !== fmtTrigger) {
                    closeFormatMenu();
                }
            }
        });

        // Close on Escape
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !fmtMenu.classList.contains("hidden")) {
                closeFormatMenu();
                fmtTrigger.focus();
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", boot);