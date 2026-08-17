import { API_URL, ROUTES } from "./config.js";

const id = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded", function () {
    const title = document.getElementById("title");
    const body = document.getElementById("body");
    const editForm = document.getElementById("edit-form");

    if (!title || !body || !editForm) return;

    function autoResize() {
        body.style.height = "auto";
        body.style.height = `${Math.max(body.scrollHeight, 220)}px`;
    }

    body.addEventListener("input", autoResize);

    async function loadblog() {
        const token = localStorage.getItem("token");

        Swal.fire({
            title: "Please Wait...",
            text: "Loading The Edit Page",
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(`${API_URL}/blog/${id}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            Swal.close();
            await Swal.fire({
                icon: "error",
                title: "Blog Not Found",
                text: "This blog could not be loaded."
            });
            window.location.href = ROUTES.PROFILE;
            return;
        }

        const blog = await response.json();
        Swal.close();

        title.value = blog.title;
        body.value = blog.body;
        autoResize();
    }

    async function editblog() {
        const token = localStorage.getItem("token");
        const newTitle = title.value;
        const newBody = body.value;

        const response = await fetch(`${API_URL}/blog/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                title: newTitle,
                body: newBody
            })
        });

        if (!response.ok) {
            const error = await response.json();

            if (response.status === 403) {
                await Swal.fire({
                    icon: "error",
                    title: "Access Denied",
                    text: error.detail || "You don't have permission to edit this blog."
                });
            } else if (response.status === 401) {
                await Swal.fire({
                    icon: "warning",
                    title: "Login Required",
                    text: "Please log in to edit this blog."
                });

                window.location.href = ROUTES.LOGIN;
            } else if (response.status === 404) {
                await Swal.fire({
                    icon: "error",
                    title: "Blog Not Found",
                    text: "This blog does not exist."
                });
            } else {
                await Swal.fire({
                    icon: "error",
                    title: "Something went wrong",
                    text: error.detail || "Unable to edit the blog."
                });
            }

            return false;
        }

        return true;
    }

    loadblog();

    editForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const result = await Swal.fire({
            title: "Publish",
            text: "Are you sure you want to edit the blog?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Confirm",
            cancelButtonText: "Cancel"
        });

        if (!result.isConfirmed) return;

        const success = await editblog();

        if (!success) return;

        await Swal.fire({
            icon: "success",
            title: "Success!",
            text: "Blog edited successfully."
        });

        window.location.href = ROUTES.PROFILE;
    });
});
