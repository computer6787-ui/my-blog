import { API_URL, notify, confirmDialog } from './config.js';

const admin = {
    token: null,
    user: null,
    currentView: 'dashboard',
};

async function init() {
    const shell = document.getElementById('admin-shell');
    const gate = document.getElementById('admin-gate');

    try {
        // Use the dedicated admin token if present; otherwise fall back to the
        // page-level token set at login so already-logged-in staff aren't locked out.
        const stored = localStorage.getItem('admin_token') || localStorage.getItem('token');
        if (!stored) {
            shell.setAttribute('data-mode', 'unauthorized');
            gate.style.display = 'flex';
            return;
        }

        admin.token = stored;

        const meRes = await fetch(`${API_URL}/user/me`, {
            headers: { Authorization: `Bearer ${admin.token}` },
            credentials: 'include',
        });

        if (!meRes.ok) {
            shell.setAttribute('data-mode', 'unauthorized');
            gate.style.display = 'flex';
            return;
        }

        admin.user = await meRes.json();

        if (admin.user.role !== 'admin' && admin.user.role !== 'moderator') {
            shell.setAttribute('data-mode', 'unauthorized');
            gate.style.display = 'flex';
            return;
        }

        shell.setAttribute('data-mode', 'authenticated');
        renderUserHeader();
        bindEvents();
        refreshBadgeCounts();
        switchView('dashboard');
    } catch (err) {
        console.error('Admin init error:', err);
        shell.setAttribute('data-mode', 'unauthorized');
        gate.style.display = 'flex';
    }
}

function renderUserHeader() {
    if (!admin.user) return;
    const avatar = document.getElementById('admin-user-avatar');
    const name = document.getElementById('admin-user-name');
    const role = document.getElementById('admin-user-role');
    if (avatar) avatar.textContent = (admin.user.name || 'U')[0].toUpperCase();
    if (name) name.textContent = admin.user.name || '—';
    if (role) role.textContent = admin.user.role || 'user';
}

async function refreshBadgeCounts() {
    try {
        const [blogsRes, commentsRes] = await Promise.all([
            fetch(`${API_URL}/admin/blogs`, { headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' }),
            fetch(`${API_URL}/admin/comments`, { headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' }),
        ]);
        let blogsCount = 0, commentsCount = 0;
        if (blogsRes.ok) { const data = await blogsRes.json(); blogsCount = data.length; }
        if (commentsRes.ok) { const data = await commentsRes.json(); commentsCount = data.length; }
        const blogsBadge = document.getElementById('nav-blogs-badge');
        const commentsBadge = document.getElementById('nav-comments-badge');
        if (blogsBadge) blogsBadge.textContent = blogsCount;
        if (commentsBadge) commentsBadge.textContent = commentsCount;
    } catch (err) { console.error('Badge count error:', err); }
}

function bindEvents() {
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
        btn.addEventListener('click', () => { const view = btn.dataset.view; if (view) switchView(view); });
    });

    const menuToggle = document.getElementById('admin-menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar) sidebar.classList.toggle('open');
        });
    }

    // Close the mobile drawer when clicking the backdrop outside it.
    const sidebarOverlay = document.getElementById('admin-sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            const sidebar = document.getElementById('admin-sidebar');
            if (sidebar) sidebar.classList.remove('open');
        });
    }

    const logoutBtn = document.getElementById('admin-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('.admin-link-btn[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => { const view = btn.dataset.goto; if (view) switchView(view); });
    });

    // Search inputs with debounce
    const usersSearch = document.getElementById('users-search');
    const blogsSearch = document.getElementById('blogs-search');
    let usersTimer, blogsTimer;
    if (usersSearch) usersSearch.addEventListener('input', (e) => { clearTimeout(usersTimer); usersTimer = setTimeout(() => loadUsers(), 350); });
    const usersRoleFilter = document.getElementById('users-role-filter');
    if (usersRoleFilter) usersRoleFilter.addEventListener('change', () => loadUsers());
    if (blogsSearch) blogsSearch.addEventListener('input', (e) => { clearTimeout(blogsTimer); blogsTimer = setTimeout(() => loadBlogs(), 350); });
    const blogsPublishedFilter = document.getElementById('blogs-published-filter');
    if (blogsPublishedFilter) blogsPublishedFilter.addEventListener('change', () => loadBlogs());
}

async function handleLogout() {
    const confirmed = await confirmDialog({
        title: 'Sign Out',
        text: 'Are you sure you want to sign out of the admin panel?',
        confirmText: 'Sign Out',
        cancelText: 'Cancel',
    });
    if (!confirmed) return;
    admin.token = null;
    admin.user = null;
    localStorage.removeItem('admin_token');
    const shell = document.getElementById('admin-shell');
    const gate = document.getElementById('admin-gate');
    if (shell) shell.setAttribute('data-mode', 'unauthorized');
    if (gate) gate.style.display = 'flex';
    notify({ type: 'info', title: 'Signed out', duration: 1800 });
}

function switchView(view) {
    admin.currentView = view;
    document.querySelectorAll('.admin-nav-item').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.view === view);
    });
    document.querySelectorAll('.admin-view').forEach(section => {
        section.classList.toggle('is-active', section.id === `view-${view}`);
    });
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        blogs: 'Blog Moderation',
        comments: 'Comment Moderation',
    };
    const titleEl = document.getElementById('admin-view-title');
    const subtitleEl = document.getElementById('admin-view-subtitle');
    if (titleEl) titleEl.textContent = titles[view] || 'Dashboard';
    if (subtitleEl) {
        const subtitles = {
            dashboard: 'Welcome back — here is an overview',
            users: 'Manage user accounts and permissions',
            blogs: 'Publish, unpublish, and remove blogs',
            comments: 'Moderate comments across the site',
        };
        subtitleEl.textContent = subtitles[view] || '';
    }
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
    if (view === 'dashboard') loadDashboard();
    else if (view === 'users') loadUsers();
    else if (view === 'blogs') loadBlogs();
    else if (view === 'comments') loadComments();
}


async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/admin/stats`, {
            headers: { Authorization: `Bearer ${admin.token}` },
            credentials: 'include',
        });
        if (!res.ok) { notify({ type: 'error', title: 'Error', text: 'Failed to load dashboard stats', duration: 3000 }); return; }
        const stats = await res.json();
        setText('stat-users', stats.users_count);
        setText('stat-blogs', stats.blogs_count);
        setText('stat-published', stats.published_count);
        setText('stat-comments', stats.comments_count);
        setText('stat-likes', stats.likes_count);
        setText('stat-moderators', stats.moderators_count);
        renderRecentBlogs(stats.recent_blogs || []);
        renderTopAuthors(stats.top_authors || []);
    } catch (err) {
        console.error('Dashboard load error:', err);
        notify({ type: 'error', title: 'Error', text: 'Failed to load dashboard', duration: 3000 });
    }
}

function renderRecentBlogs(blogs) {
    const container = document.getElementById('recent-blogs-list');
    if (!container) return;
    if (!blogs || blogs.length === 0) { container.innerHTML = '<p class="admin-empty">No blogs yet.</p>'; return; }
    container.innerHTML = blogs.map(blog => `
        <div class="admin-recent-item">
            <div class="admin-recent-item-icon">${(blog.title || '?')[0].toUpperCase()}</div>
            <div class="admin-recent-item-content">
                <div class="admin-recent-item-title">${escapeHtml(blog.title || 'Untitled')}</div>
                <div class="admin-recent-item-meta">
                    <span>by ${escapeHtml(blog.author || 'Unknown')}</span>
                    <span>${blog.category || 'General'}</span>
                    <span class="admin-recent-item-date">${blog.published ? '✅ Published' : '⏳ Draft'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderTopAuthors(authors) {
    const container = document.getElementById('top-authors-list');
    if (!container) return;
    if (!authors || authors.length === 0) { container.innerHTML = '<p class="admin-empty">No authors yet.</p>'; return; }
    container.innerHTML = authors.map(author => `
        <div class="admin-author-item">
            <div class="admin-author-avatar">${(author.name || '?')[0].toUpperCase()}</div>
            <div class="admin-author-info">
                <h4>${escapeHtml(author.name || 'Unknown')}</h4>
                <p>${author.blog_count || 0} blog${(author.blog_count || 0) !== 1 ? 's' : ''} written</p>
            </div>
        </div>
    `).join('');
}


async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="admin-loading-row">Loading...</td></tr>';
    const q = document.getElementById('users-search')?.value || '';
    const role = document.getElementById('users-role-filter')?.value || '';
    let url = `${API_URL}/admin/users`;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (role) params.set('role', role);
    if (params.toString()) url += `?${params.toString()}`;
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();
        if (!users || users.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">No users found.</td></tr>'; return; }
        const viewerIsOwner = admin.user && admin.user.is_owner;
        tbody.innerHTML = users.map(user => {
            const isOwner = user.is_owner;
            const isTargetAdmin = user.role === 'admin';
            // Owner rows: completely locked
            // Admin rows viewed by non-owner: also locked (only owner can manage admins)
            const locked = isOwner || (isTargetAdmin && !viewerIsOwner);
            return `
            <tr class="${isOwner ? 'admin-row-owner' : ''}">
                <td>
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <div class="admin-author-avatar" style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;">${(user.name || '?')[0].toUpperCase()}</div>
                        <span>${escapeHtml(user.name)}${isOwner ? ' <span class="admin-owner-badge" title="Site Owner">👑 Owner</span>' : ''}</span>
                    </div>
                </td>
                <td>${escapeHtml(user.email)}</td>
                <td>${user.blogs_count || 0}</td>
                <td><span class="admin-role-badge admin-role-${user.role || 'user'}">${user.role || 'user'}</span></td>
                <td><span class="admin-status-badge ${user.is_active ? 'admin-status-active' : 'admin-status-inactive'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td class="admin-table-actions">
                    <div class="admin-action-buttons">
                        ${locked
                            ? `<span class="admin-locked" title="${isOwner ? 'The site owner cannot be modified' : 'Only the site owner can manage admin accounts'}">🔒</span>`
                            : `<select class="admin-role-select" data-id="${user.id}" aria-label="Change role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option><option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option></select>`
                        }
                        <button class="admin-btn-icon ${user.is_active ? 'admin-btn-active' : 'admin-btn-inactive'}" data-id="${user.id}" data-action="toggle-active" aria-label="${user.is_active ? 'Deactivate' : 'Activate'}" ${locked ? 'disabled title="Cannot modify this account"' : ''}>${user.is_active ? '🟢' : '⚪'}</button>
                        <button class="admin-btn-icon admin-btn-danger" data-id="${user.id}" data-action="delete" aria-label="Delete user" ${locked ? 'disabled title="Cannot delete this account"' : ''}>🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        bindUserActions(users);
    } catch (err) {
        console.error('Load users error:', err);
        tbody.innerHTML = '<tr><td colspan="6" class="admin-empty">Failed to load users.</td></tr>';
    }
}


function bindUserActions(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.querySelectorAll('.admin-role-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const userId = parseInt(e.target.dataset.id);
            const newRole = e.target.value;
            const user = users.find(u => u.id === userId);
            if (!user || newRole === user.role) return;
            if (user.is_owner) return;
            if (user.role === 'admin' && !(admin.user && admin.user.is_owner)) return;
            const confirmed = await confirmDialog({ title: 'Change Role', text: `Set ${user.name}'s role to "${newRole}"?`, confirmText: 'Confirm', cancelText: 'Cancel' });
            if (!confirmed) { e.target.value = user.role; return; }
            try {
                const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, credentials: 'include', body: JSON.stringify({ role: newRole }) });
                if (res.ok) { notify({ type: 'success', title: 'Updated', text: 'Role updated', duration: 2000 }); loadUsers(); refreshBadgeCounts(); }
                else { const errData = await res.json(); notify({ type: 'error', title: 'Error', text: errData.detail || 'Failed to update role', duration: 3000 }); }
            } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
        });
    });
    tbody.querySelectorAll('[data-action="toggle-active"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = parseInt(e.currentTarget.dataset.id);
            const user = users.find(u => u.id === userId);
            if (!user || user.is_owner) return;
            if (user.role === 'admin' && !(admin.user && admin.user.is_owner)) return;
            const newActive = !user.is_active;
            const confirmed = await confirmDialog({ title: 'Toggle Status', text: `${newActive ? 'Activate' : 'Deactivate'} this user?`, confirmText: 'Confirm', cancelText: 'Cancel' });
            if (!confirmed) return;
            try {
                const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, credentials: 'include', body: JSON.stringify({ is_active: newActive }) });
                if (res.ok) { notify({ type: 'success', title: 'Updated', text: 'Status updated', duration: 2000 }); loadUsers(); refreshBadgeCounts(); }
                else { notify({ type: 'error', title: 'Error', text: 'Failed to update status', duration: 3000 }); }
            } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
        });
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = parseInt(e.currentTarget.dataset.id);
            const user = users.find(u => u.id === userId);
            if (!user || user.is_owner) return;
            if (user.role === 'admin' && !(admin.user && admin.user.is_owner)) return;
            const confirmed = await confirmDialog({ title: 'Delete User', text: `Are you sure you want to delete ${user?.name || 'this user'}? This cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel' });
            if (!confirmed) return;
            try {
                const res = await fetch(`${API_URL}/admin/users/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
                if (res.ok || res.status === 204) { notify({ type: 'success', title: 'Deleted', text: 'User removed', duration: 2000 }); loadUsers(); refreshBadgeCounts(); }
                else { const errData = await res.json(); notify({ type: 'error', title: 'Error', text: errData.detail || 'Failed to delete', duration: 3000 }); }
            } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
        });
    });
}


async function loadBlogs() {
    const tbody = document.getElementById('blogs-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="admin-loading-row">Loading...</td></tr>';
    const q = document.getElementById('blogs-search')?.value || '';
    const published = document.getElementById('blogs-published-filter')?.value || '';
    let url = `${API_URL}/admin/blogs`;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (published !== '') params.set('published', published);
    if (params.toString()) url += `?${params.toString()}`;
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load blogs');
        const blogs = await res.json();
        if (!blogs || blogs.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">No blogs found.</td></tr>'; return; }
        tbody.innerHTML = blogs.map(blog => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <div class="admin-recent-item-icon">${(blog.title || '?')[0].toUpperCase()}</div>
                        <span style="font-weight:600;">${escapeHtml(blog.title || 'Untitled')}</span>
                    </div>
                </td>
                <td>${escapeHtml(blog.author || 'Unknown')}</td>
                <td><span class="admin-category-badge">${escapeHtml(blog.category || 'General')}</span></td>
                <td>❤️ ${blog.likes_count || 0}</td>
                <td>💬 ${blog.comments_count || 0}</td>
                <td><span class="admin-status-badge ${blog.published ? 'admin-status-active' : 'admin-status-inactive'}">${blog.published ? 'Published' : 'Draft'}</span></td>
                <td class="admin-table-actions">
                    <button class="admin-btn-icon ${blog.published ? 'admin-btn-active' : 'admin-btn-inactive'}" data-id="${blog.id}" data-action="toggle-publish" aria-label="${blog.published ? 'Unpublish' : 'Publish'}">${blog.published ? '📢' : '📝'}</button>
                    <button class="admin-btn-icon admin-btn-danger" data-id="${blog.id}" data-action="delete" aria-label="Delete blog">🗑️</button>
                </td>
            </tr>
        `).join('');
        bindBlogActions(blogs);
    } catch (err) {
        console.error('Load blogs error:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">Failed to load blogs.</td></tr>';
    }
}

function bindBlogActions(blogs) {
    const tbody = document.getElementById('blogs-table-body');
    if (!tbody) return;
    tbody.querySelectorAll('[data-action="toggle-publish"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const blogId = parseInt(e.currentTarget.dataset.id);
            const currentPublished = e.currentTarget.classList.contains('admin-btn-active');
            const newPublished = !currentPublished;
            try {
                const res = await fetch(`${API_URL}/admin/blogs/${blogId}/publish`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, credentials: 'include', body: JSON.stringify({ published: newPublished }) });
                if (res.ok) { notify({ type: 'success', title: 'Updated', text: `Blog ${newPublished ? 'published' : 'unpublished'}`, duration: 2000 }); loadBlogs(); refreshBadgeCounts(); }
                else { notify({ type: 'error', title: 'Error', text: 'Failed to update blog', duration: 3000 }); }
            } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
        });
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const blogId = parseInt(e.currentTarget.dataset.id);
            const confirmed = await confirmDialog({ title: 'Delete Blog', text: 'Are you sure you want to delete this blog? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel' });
            if (!confirmed) return;
            try {
                const res = await fetch(`${API_URL}/admin/blogs/${blogId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
                if (res.ok || res.status === 204) { notify({ type: 'success', title: 'Deleted', text: 'Blog removed', duration: 2000 }); loadBlogs(); refreshBadgeCounts(); }
                else { notify({ type: 'error', title: 'Error', text: 'Failed to delete blog', duration: 3000 }); }
            } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
        });
    });
}


async function loadComments() {
    const tbody = document.getElementById('comments-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="admin-loading-row">Loading...</td></tr>';
    try {
        const res = await fetch(`${API_URL}/admin/comments`, { headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load comments');
        const comments = await res.json();
        if (!comments || comments.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">No comments found.</td></tr>'; return; }
        tbody.innerHTML = comments.map(comment => `
            <tr>
                <td><strong>${escapeHtml(comment.user_name || 'Unknown')}</strong></td>
                <td style="max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(comment.content)}">${escapeHtml(comment.content)}</td>
                <td>${escapeHtml(comment.blog_title || 'Deleted blog')}</td>
                <td>${comment.created_at ? new Date(comment.created_at).toLocaleString() : '—'}</td>
                <td class="admin-table-actions">
                    <button class="admin-btn-icon admin-btn-danger" data-id="${comment.id}" data-action="delete" aria-label="Delete comment">🗑️</button>
                </td>
            </tr>
        `).join('');
        tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const commentId = parseInt(e.currentTarget.dataset.id);
                const confirmed = await confirmDialog({ title: 'Delete Comment', text: 'Are you sure you want to delete this comment?', confirmText: 'Delete', cancelText: 'Cancel' });
                if (!confirmed) return;
                try {
                    const res = await fetch(`${API_URL}/admin/comments/${commentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` }, credentials: 'include' });
                    if (res.ok || res.status === 204) { notify({ type: 'success', title: 'Deleted', text: 'Comment removed', duration: 2000 }); loadComments(); }
                    else { notify({ type: 'error', title: 'Error', text: 'Failed to delete comment', duration: 3000 }); }
                } catch (err) { notify({ type: 'error', title: 'Error', text: 'Network error', duration: 3000 }); }
            });
        });
    } catch (err) {
        console.error('Load comments error:', err);
        tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Failed to load comments.</td></tr>';
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

init();

