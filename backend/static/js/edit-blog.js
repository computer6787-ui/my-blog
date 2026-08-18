import { API_URL, ROUTES, showLoading, hideLoading, notify, confirmDialog } from "./config.js?v=20260818";

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

        showLoading("Loading the edit page...");

        try {
            const response = await fetch(`${API_URL}/blog/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                hideLoading();
                await notify({
                    type: "error",
                    title: "Blog Not Found",
                    text: "This blog could not be loaded."
                });
                window.location.href = ROUTES.PROFILE;
                return;
            }

            const blog = await response.json();
            title.value = blog.title;
            body.value = blog.body;
            autoResize();
        } catch (error) {
            console.error(error);
            hideLoading();
            await notify({
                type: "error",
                title: "Connection Error",
                text: "Could not load the blog right now."
            });
            return;
        } finally {
            hideLoading();
        }
    }

    async function editblog() {
        const token = localStorage.getItem("token");
        const newTitle = title.value;
        const newBody = body.value;

        showLoading("Saving blog changes...");

        try {
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
                    await notify({
                        type: "error",
                        title: "Access Denied",
                        text: error.detail || "You don't have permission to edit this blog."
                    });
                } else if (response.status === 401) {
                    await notify({
                        type: "warning",
                        title: "Login Required",
                        text: "Please log in to edit this blog.",
                        onClick: () => {
                            window.location.href = ROUTES.LOGIN;
                        }
                    });

                    window.location.href = ROUTES.LOGIN;
                } else if (response.status === 404) {
                    await notify({
                        type: "error",
                        title: "Blog Not Found",
                        text: "This blog does not exist."
                    });
                } else {
                    await notify({
                        type: "error",
                        title: "Something went wrong",
                        text: error.detail || "Unable to edit the blog."
                    });
                }

                return false;
            }

            return true;
        } finally {
            hideLoading();
        }
    }

    loadblog();

    editForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const confirmed = await confirmDialog({
            title: "Publish",
            text: "Are you sure you want to edit the blog?",
            confirmText: "Confirm",
            cancelText: "Cancel"
        });

        if (!confirmed) return;

        const success = await editblog();

        if (!success) return;

        await notify({
            type: "success",
            title: "Success!",
            text: "Blog edited successfully."
        });

        window.location.href = ROUTES.PROFILE;
    });
});
