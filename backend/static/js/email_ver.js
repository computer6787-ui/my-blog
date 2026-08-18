import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";
document.addEventListener('DOMContentLoaded', function() {
    const email = document.getElementById("email");


  const userForm = document.getElementById("reset_pass_form");


    userForm.addEventListener("submit", createUser);

    async function createUser(event) {

        event.preventDefault();
        const userEmail = email.value;
        showLoading("Sending verification code...");
        try {
            const response = await fetch(`${API_URL}/user/ver_email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: userEmail
                })
            });

            if (response.ok) {
                await notify({
                    type: "success",
                    title: "Code sent",
                    text: "A verification code has been sent to your email."
                });
                localStorage.setItem("userEmail", userEmail);
                window.location.href = "/Verify_user";

            }else {
               await notify({
                    type: "error",
                    title: "Oops!",
                    text: "Something went wrong."
                });
            }

        } catch (error) {
            console.error("Network error:", error);
            await notify({
                type: "error",
                title: "Connection Error",
                text: "Could not send the verification email."
            });
        } finally {
            hideLoading();
        }
    }
});