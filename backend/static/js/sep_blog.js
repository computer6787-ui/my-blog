const parts = window.location.pathname.split("/");
const id = parts[parts.length - 1];
import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";

async function loadBlog() {
    const token = localStorage.getItem("token");

    showLoading("Loading blog...");

    try {
        const response = await fetch(`${API_URL}/blog/${id}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            await notify({
                type: "warning",
                title: "Login Required",
                text: "Please log in to write a blog.",
                onClick: () => {
                    window.location.href = ROUTES.LOGIN;
                }
            });
            window.location.href = ROUTES.LOGIN;
            return;
        }

        if (response.status === 404) {
            await notify({
                type: "error",
                title: "No blog found",
                text: "No blogs found with this ID."
            });
            return;
        }

        if (!response.ok) {
            await notify({
                type: "error",
                title: "Oops!",
                text: "Something went wrong."
            });
            return;
        }

        const blog = await response.json();

        document.getElementById("title").textContent = blog.title;
        document.getElementById("body").textContent = blog.body;
        document.getElementById("author").textContent = blog.creator.name;
    } catch (error) {
        console.error(error);
        await notify({
            type: "error",
            title: "Connection Error",
            text: "Could not load this blog right now."
        });
    } finally {
        hideLoading();
    }
}

loadBlog();