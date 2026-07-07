const parts = window.location.pathname.split("/");
const id = parts[parts.length - 1];

async function loadBlog() {
    const token = localStorage.getItem("token");

    const response = await fetch(`http://127.0.0.1:8000/blog/${id}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (response.status === 401) {
        alert("Please log in to read the full blog.");
        window.location.href = "/frontend/login.html";
        return;
    }

    if (response.status === 404) {
        alert("Blog not found.");
        return;
    }

    if (!response.ok) {
        alert("Something went wrong.");
        return;
    }

    const blog = await response.json();

    document.getElementById("title").textContent = blog.title;
    document.getElementById("body").textContent = blog.body;
    document.getElementById("author").textContent = blog.creator.name;
}

loadBlog();