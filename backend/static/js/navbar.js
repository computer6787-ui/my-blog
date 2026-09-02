(function() {
    function applyTheme(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
        const toggleBtn = document.getElementById('drawer-theme-toggle');
        const label = document.getElementById('drawer-theme-label');
        const icon = document.getElementById('drawer-theme-icon');
        if (icon) icon.textContent = isDark ? '☀️' : '🌙';
        if (label) {
            label.textContent = isDark ? 'Dark mode' : 'Light mode';
            // Restart the slide animation so the label visibly slides each toggle
            label.style.animation = 'none';
            void label.offsetWidth;
            label.style.animation = '';
        }
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-pressed', String(isDark));
            toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        }
        try {
            localStorage.setItem('lumora-theme', isDark ? 'dark' : 'light');
        } catch (error) {
            // no-op for restricted environments
        }
    }

    function syncThemeFromStorage() {
        try {
            const savedTheme = localStorage.getItem('lumora-theme');
            if (savedTheme === 'dark') {
                applyTheme('dark');
            } else {
                applyTheme('light');
            }
        } catch (error) {
            applyTheme('light');
        }
    }

    function initDarkMode() {
        const menuBtn = document.getElementById('menu-btn');
        const drawer = document.getElementById('drawer');
        const overlay = document.querySelector('.overlay');
        const toggleBtn = document.getElementById('drawer-theme-toggle');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
                applyTheme(nextTheme);
            });
            syncThemeFromStorage();
        }

        if (menuBtn && drawer) {
            menuBtn.addEventListener('click', function() {
                menuBtn.classList.toggle('open');
                drawer.classList.toggle('open');
                if (overlay) {
                    overlay.classList.toggle('visible');
                }
            });
        }

        if (overlay) {
            overlay.addEventListener('click', function() {
                if (drawer) {
                    drawer.classList.remove('open');
                }
                if (menuBtn) {
                    menuBtn.classList.remove('open');
                }
                overlay.classList.remove('visible');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDarkMode);
    } else {
        initDarkMode();
    }
})();