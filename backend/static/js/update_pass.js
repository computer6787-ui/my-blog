import { API_URL, showLoading, hideLoading, notify } from "./config.js?v=20260818";

const form = document.getElementById("updatePassForm");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const showPassword = document.getElementById("showPassword");
const message = document.getElementById("message");

const email = localStorage.getItem("userEmail");

// Check if email exists
if (!email) {
    message.textContent = "No email found. Please restart the password reset process.";
    form.querySelector("button[type='submit']").disabled = true;
}


// Show / hide password
showPassword.addEventListener("change", () => {
    const type = showPassword.checked ? "text" : "password";

    password.type = type;
    confirmPassword.type = type;
});


// Update password
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    message.textContent = "";

    const newPassword = password.value;
    const confirmPass = confirmPassword.value;

    // Check password match
    if (newPassword !== confirmPass) {
        message.textContent = "Passwords do not match.";
        return;
    }

    // Don't allow empty password
    if (!newPassword) {
        message.textContent = "Please enter a password.";
        return;
    }

    showLoading("Updating your password...");

    try {
        const res = await fetch(`${API_URL}/user/edit_pass`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                new_password: newPassword
            })
        });

        const data = await res.json();

        if (res.status === 202) {

            await notify({
                type: "success",
                title: "Password Updated!",
                text: "Your password has been changed successfully."
            });

            // Remove reset-related data
            localStorage.removeItem("email");

            // Go to login
            window.location.href = "/login";

        } else {
            message.textContent = data.detail || "Failed to update password.";
        }

    } catch (error) {
        console.error("Error:", error);
        message.textContent = "Something went wrong. Please try again.";
    } finally {
        hideLoading();
    }
});