import { ROUTES, notify } from './config.js?v=20260818';

document.addEventListener('DOMContentLoaded', function() {
    const readBlogsButton = document.getElementById('read_blogs');
    const writeBlogButton = document.getElementById('write_blog');
    const blogSection = document.getElementById('blog_section');

    if (readBlogsButton && blogSection) {
        readBlogsButton.addEventListener('click', function(event) {
            event.preventDefault();
            blogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    if (writeBlogButton) {
        writeBlogButton.addEventListener('click', async function(event) {
            event.preventDefault();
            event.stopPropagation();

            const token = localStorage.getItem('token');

            if (token) {
                window.location.assign(ROUTES.CREATE_BLOG);
                return;
            }

            try {
                await notify({
                    type: 'warning',
                    title: 'Login Required',
                    text: 'Please log in to write a blog.',
                    duration: 2600,
                    onClick: () => {
                        window.location.assign(ROUTES.LOGIN);
                    }
                });
            } finally {
                window.location.assign(ROUTES.LOGIN);
            }
        });
    }
});