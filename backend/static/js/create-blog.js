import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";

document.addEventListener("DOMContentLoaded", function () {

    const title = document.getElementById("title");
    const body = document.getElementById("body");
    const blogForm = document.getElementById("blog_form");

    if (!title || !body || !blogForm) return;

    blogForm.addEventListener("submit", createBlog);

    function autoResize() {
        body.style.height = "auto";
        body.style.height = `${Math.max(body.scrollHeight, 220)}px`;
    }

    body.addEventListener("input", autoResize);

    autoResize();


    async function createBlog(event) {
        event.preventDefault();

        const blogTitle = title.value;
        const blogBody = body.value;
        const token = localStorage.getItem("token");

        showLoading("Creating blog...");

        try {
            const response = await fetch(`${API_URL}/blog`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: blogTitle,
                    body: blogBody
                })
            });

            if (response.ok) {

                hideLoading();

                await notify({
                    type: "success",
                    title: "Success!",
                    text: "Blog created successfully."
                });

                window.location.href = ROUTES.HOME;

            } else if (response.status === 401) {

                hideLoading();

                await notify({
                    type: "warning",
                    title: "Login Required",
                    text: "Please log in to write a blog.",
                    onClick: () => {
                        window.location.href = ROUTES.LOGIN;
                    }
                });

                window.location.href = ROUTES.LOGIN;

            } else {

                hideLoading();

                await notify({
                    type: "error",
                    title: "Oops!",
                    text: "Something went wrong."
                });
            }

        } catch (error) {

            hideLoading();

            console.error("Network error:", error);

            await notify({
                type: "error",
                title: "Connection Error",
                text: "Could not connect to the server. Please try again."
            });
        }
    }
});