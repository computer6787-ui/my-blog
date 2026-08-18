import { API_URL, showLoading, hideLoading, notify } from "./config.js?v=20260818";

const form = document.getElementById("verifyForm");
const message = document.getElementById("message");
const resendBtn = document.getElementById("resendBtn");

const email = localStorage.getItem("pending_email");

if (!email) {
    message.textContent = "No email found. Please register again.";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("code").value;
    showLoading("Verifying your account...");

    try {
        const res = await fetch(`${API_URL}/verify`, {
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
                text: "Account verified successfully."
            });

            localStorage.removeItem("pending_email");
            window.location.href = "/login";
        } else {
            message.textContent = data.detail;
        }
    } catch (error) {
        console.error(error);
        message.textContent = "Verification failed. Please try again.";
    } finally {
        hideLoading();
    }
});

resendBtn.addEventListener("click", async () => {
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
            message.textContent = data.detail;
        }
    } catch (error) {
        console.error(error);
        message.textContent = "Could not resend the code right now.";
    } finally {
        hideLoading();
    }
});