

let skip = 0;
const limit = 4;
import { API_URL,ROUTES } from "./config.js";
async function loadBlogs() {
const response = await fetch(`${API_URL}/blog?limit=${limit}&skip=${skip}`);

    const blogs = await response.json();

    if (blogs.length === 0) {
        await Swal.fire({
        icon: "warning",
        title: "No more blogs",
        text: "No more blogs to fetch,maybe write some?"
});
        return;
    }

    const section = document.getElementById("blog_section");

    blogs.forEach(blog => {
        const article = document.createElement("article");
        article.className = "blog-card";

        article.innerHTML = `
            <hr>
            <h2>${blog.title}</h2>
            <p>${blog.body.slice(0, 70)}...</p>

            <button class="readmore_button" onclick="readMore(${blog.id})">
                Read More...
            </button>
            <hr>
        `;

        section.appendChild(article);
    });

    skip += limit;
}

document.addEventListener("DOMContentLoaded", loadBlogs);

async function loadMore() {
    await loadBlogs();
}

async function readMore(id) {
    const token = localStorage.getItem("token");

    if (!token) {
        await Swal.fire({
    icon: "warning",
    title: "Login Required",
    text: "Please log in to see the blog."
});

        window.location.href = ROUTES.LOGIN; 
        return;
    }

    window.location.href = `/blogs/${id}`;
}
window.loadMore = loadMore;
window.readMore = readMore;