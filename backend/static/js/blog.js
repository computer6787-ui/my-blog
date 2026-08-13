let skip = 0;
const limit = 4;
let currentSearch = "";

import { API_URL, ROUTES } from "./config.js";

function showBlogLoading(message = "Loading blogs...") {
    const section = document.getElementById("blog_section");

    const loading = document.createElement("div");
    loading.className = "blog-loading";
    loading.innerHTML = `
        <div class="blog-loading-spinner"></div>
        <span>${message}</span>
    `;

    section.appendChild(loading);
}

function hideBlogLoading() {
    const loading = document.querySelector(".blog-loading");

    if (loading) {
        loading.remove();
    }
}

async function loadBlogs(search = "") {
    const loadMore_button = document.getElementById("load_more");
    const section = document.getElementById("blog_section");
    const response = await fetch(`${API_URL}/blog?limit=${limit}&skip=${skip}&q=${encodeURIComponent(search)}`
    );

    const data = await response.json();
    const blogs=data.blogs;
    const total=data.total;
    hideBlogLoading();

    // No blogs found
    if (blogs.length === 0) {
        loadMore_button.style.display = "none";

        Swal.fire({
            icon: "info",
            title: "No blogs found!",
            text: search
                ? "There are no blogs matching your search."
                : "There are no blogs available right now. Be the first to write one!",
            confirmButtonText: "Got it"
        });

        return;
    }

    // Display blogs
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

    // Increase skip by the amount actually loaded
    skip += blogs.length;

    // If fewer than the limit were returned,
    // this was the last batch.
    if (skip >= total) {
        loadMore_button.style.display = "none";
    } else {
        loadMore_button.style.display = "";
    }
}


// Search button
document
    .getElementById("search_button")
    .addEventListener("click", performSearch);


// Press Enter in search bar
document
    .getElementById("search_bar")
    .addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            performSearch();
        }
    });


// Perform search
async function performSearch() {
    currentSearch = document
        .getElementById("search_bar")
        .value
        .trim();

    // Start from the first result
    skip = 0;

    // Remove currently displayed blogs
    const section = document.getElementById("blog_section");

    section.innerHTML = "";
    showBlogLoading("Searching blogs...");
    

    // Load search results
    await loadBlogs(currentSearch);
    hideBlogLoading();
}


// Load more button
async function loadMore() {
    showBlogLoading("Loading more blogs")
    await loadBlogs(currentSearch);
    hideBlogLoading();
}


// Read more
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


// Make readMore available to inline onclick
window.readMore = readMore;


// Load more button listener
document.getElementById("load_more").addEventListener("click", loadMore);


// Initial load
document.addEventListener("DOMContentLoaded", async() => {
    showBlogLoading("Loading the most relevant blogs...")
    await loadBlogs();
    hideBlogLoading();
});