import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";
document.addEventListener('DOMContentLoaded', function() {
    const name=document.getElementById("username")
    const email = document.getElementById("email");
    const password = document.getElementById("password");


  const userForm = document.getElementById("register");


    userForm.addEventListener("submit", createUser);

    async function createUser(event) {

        event.preventDefault();
        const userName=name.value;
        const userEmail = email.value;
        const userPassword = password.value;
        showLoading("Sending verification code...");
        try {
            const response = await fetch(`${API_URL}/user/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: userName,
                    email: userEmail,
                    password: userPassword
                })
            });

            if (response.ok) {
                await notify({
                    type: "success",
                    title: "Verification sent",
                    text: "A verification code has been sent to your email."
                });
                localStorage.setItem("pending_email", userEmail);
                window.location.href = "/verify";

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
                text: "Could not register right now. Please try again."
            });
        } finally {
            hideLoading();
        }
    }
    
    // Password toggle functionality
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if(togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function(event) {
            event.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '🙈' : '🐵';
        });
    }
});