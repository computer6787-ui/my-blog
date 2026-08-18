import { API_URL, ROUTES, showLoading, hideLoading, notify } from "./config.js?v=20260818";

document.addEventListener('DOMContentLoaded', function() {
    const loginform = document.getElementById('login_form');
    loginform.addEventListener('submit',async function(event) {
        event.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        showLoading('Logging you in...');

        try {
            const response = await fetch(`${API_URL}/login`,{
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body:JSON.stringify({
                    username:email,
                    password:password
                }),
            });
            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            const token = localStorage.getItem("token");

            if(response.status==200){
                await notify({
                    type: "success",
                    title: "Welcome back",
                    text: "You have been logged in successfully."
                });
                window.location.href = ROUTES.HOME;
            }

            if(response.status==404 || response.status==400){
                await notify({
                    type: "error",
                    title: "Invalid request",
                    text: "You have entered your password or email wrong."
                });
                localStorage.removeItem("token");
                window.location.reload();
            }
        } catch (error) {
            console.error(error);
            await notify({
                type: "error",
                title: "Connection error",
                text: "Could not log in right now. Please try again."
            });
        } finally {
            hideLoading();
        }

    });
    
    // Password toggle functionality
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    
    if(togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function(event) {
            event.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
        });
    }
});  