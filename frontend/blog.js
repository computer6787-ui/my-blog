let skip = 0;
const limit = 4;

async function loadBlogs() {
    const response = await fetch(`http://127.0.0.1:8000/blog?limit=${limit}&skip=${skip}`);

    const blogs = await response.json();

    if (blogs.length === 0) {
        alert("No more blogs to load.");
        return;
    }

    const section = document.getElementById("blog_section");

    blogs.forEach(blog => {
        const article = document.createElement("article");
        article.className = "blog-card";

        article.innerHTML = `
            <hr>
            <h2>${blog.title}</h2>
            <p>${blog.body.slice(0, 100)}...</p>

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

function readMore(id) {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please log in to read the full blog.");

        window.location.href = "/frontend/login.html"; 
        return;
    }

    window.location.href = `/blogs/${id}`;
}