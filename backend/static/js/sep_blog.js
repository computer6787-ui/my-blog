const parts = window.location.pathname.split("/");
const id = parts[parts.length - 1];
import { API_URL,ROUTES } from "./config.js";

async function loadBlog() {
    const token = localStorage.getItem("token");

    Swal.fire({
    title: "Loading...",
    allowOutsideClick: false,
    didOpen: () => {
    Swal.showLoading();
        }
    });
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
        window.location.href =ROUTES.LOGIN;
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
    swal.close()

    document.getElementById("title").textContent = blog.title;
    document.getElementById("body").textContent = blog.body;
    document.getElementById("author").textContent = blog.creator.name;
}

loadBlog();