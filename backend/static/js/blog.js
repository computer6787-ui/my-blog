let skip = 0;
const limit = 4;
let currentSearch = "";
import { API_URL,ROUTES } from "./config.js";
async function loadBlogs(search = "") {
const response = await fetch(`${API_URL}/blog?limit=${limit}&skip=${skip}&q=${encodeURIComponent(search)}`);

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

document.getElementById("search_button").addEventListener("click", performSearch);
document.getElementById("search_bar").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        performSearch();
    }
});
async function performSearch() {
    

    // Get user's search
    currentSearch = document.getElementById("search_bar").value.trim();

    // Start from the first search result
    skip = 0;

    // Remove currently displayed blogs
    const section = document.getElementById("blog_section");
    section.innerHTML = "";

    // Ask backend for matching blogs
    await loadBlogs(currentSearch);
}


document.addEventListener("DOMContentLoaded", loadBlogs());

async function loadMore() {
    await loadBlogs(currentSearch);
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