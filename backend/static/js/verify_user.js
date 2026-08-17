import { API_URL } from "./config.js";

const form = document.getElementById("verifyForm");
const message = document.getElementById("message");
const resendBtn = document.getElementById("resendBtn");

const email = localStorage.getItem("userEmail");

if (!email) {
    message.textContent = "No email found. Please enter your email again.";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const code = document.getElementById("code").value;

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
    await Swal.fire({
    icon: "success",
    title: "Success!",
    text: "Account verified successfully."
});


        window.location.href = "/Update_pass";
    } else {
        message.textContent = data.detail;
    }
});

resendBtn.addEventListener("click", async () => {

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
        alert("A new verification code has been sent.");
    } else {
        message.textContent = data.detail;
    }
});