const parts = window.location.pathname.split("/");
const id = parts[parts.length - 1];
const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";

async function loadBlog() {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/blog/${id}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (response.status === 401) {
        await Swal.fire({
    icon: "warning",
    title: "Login Required",
    text: "Please log in to write a blog."
});
        window.location.href = "/frontend/login.html";
        return;
    }

    if (response.status === 404) {
        await Swal.fire({
    icon: "error",
    title: "No blog found",
    text: "No blogs found with this ID."
});
        return;
    }

    if (!response.ok) {
        await Swal.fire({
    icon: "error",
    title: "Oops!",
    text: "Something went wrong."
});
        return;
    }

    const blog = await response.json();

    document.getElementById("title").textContent = blog.title;
    document.getElementById("body").textContent = blog.body;
    document.getElementById("author").textContent = blog.creator.name;
}

loadBlog();