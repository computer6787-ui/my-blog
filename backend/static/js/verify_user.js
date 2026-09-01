import { API_URL, showLoading, hideLoading, notify } from "./config.js?v=20260818";

const form = document.getElementById("verifyForm");
const message = document.getElementById("message");
const resendBtn = document.getElementById("resendBtn");

const email = localStorage.getItem("userEmail");

if (!email) {
    message.textContent = "No email found. Please enter your email again.";
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!email) {
            message.textContent = "No email found. Please enter your email again.";
            return;
        }

        const code = document.getElementById("code").value;

        showLoading("Verifying your code...");

        try {
            const res = await fetch(`${API_URL}/verify_user`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    verification_code: code
                })
            });

            const data = await res.json();

            if (res.ok) {
                await notify({
                    type: "success",
                    title: "Success!",
                    text: "Code verified successfully."
                });

                window.location.href = "/Update_pass";
            } else {
                message.textContent = data.detail || "Verification failed.";
            }
        } catch (error) {
            console.error(error);
            message.textContent = "Verification failed. Please try again.";
        } finally {
            hideLoading();
        }
    });
}

if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
        if (!email) {
            message.textContent = "No email found. Please enter your email again.";
            return;
        }

        showLoading("Resending code...");

        try {
            const res = await fetch(`${API_URL}/resend-code`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email
                })
            });

            const data = await res.json();

            if (res.ok) {
                await notify({
                    type: "success",
                    title: "Code sent",
                    text: "A new verification code has been sent."
                });
            } else {
                message.textContent = data.detail || "Could not resend the code right now.";
            }
        } catch (error) {
            console.error(error);
            message.textContent = "Could not resend the code right now.";
        } finally {
            hideLoading();
        }
    });
}
