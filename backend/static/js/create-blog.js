import { API_URL, ROUTES } from "./config.js";

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

        Swal.fire({
            title: "Creating blog...",
            text: "Please wait while your blog is being published.",
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

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

            Swal.close();

            if (response.ok) {

                await Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: "Blog created successfully."
                });

                window.location.href = ROUTES.HOME;

            } else if (response.status === 401) {

                await Swal.fire({
                    icon: "warning",
                    title: "Login Required",
                    text: "Please log in to write a blog."
                });

                window.location.href = ROUTES.LOGIN;

            } else {

                await Swal.fire({
                    icon: "error",
                    title: "Oops!",
                    text: "Something went wrong."
                });
            }

        } catch (error) {

            Swal.close();

            console.error("Network error:", error);

            await Swal.fire({
                icon: "error",
                title: "Connection Error",
                text: "Could not connect to the server. Please try again."
            });
        }
    }
});