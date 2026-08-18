(function() {
    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-mode', isDark);
        const toggleBtn = document.getElementById('dark-mode-toggle');
        if (toggleBtn) {
            toggleBtn.textContent = isDark ? '☀️' : '🌙';
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
        const nav = document.querySelector('.nav');
        const menuBtn = document.getElementById('menu-btn');
        const drawer = document.getElementById('drawer');
        const overlay = document.querySelector('.overlay');
        let toggleBtn = document.getElementById('dark-mode-toggle');

        if (nav && !toggleBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.id = 'dark-mode-toggle';
            toggleBtn.type = 'button';
            toggleBtn.setAttribute('aria-label', 'Toggle dark mode');
            toggleBtn.textContent = '🌙';
            nav.appendChild(toggleBtn);
        }

        const initializeTheme = () => {
            const savedTheme = (() => {
                try {
                    return localStorage.getItem('lumora-theme');
                } catch (error) {
                    return null;
                }
            })();

            if (savedTheme === 'dark' || document.body.classList.contains('dark-mode')) {
                applyTheme('dark');
            } else {
                applyTheme('light');
            }
        };

        if (toggleBtn) {
            toggleBtn.onclick = function() {
                const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
                applyTheme(nextTheme);
            };
            initializeTheme();
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