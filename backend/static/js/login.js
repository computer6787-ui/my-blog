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
            this.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
            // Eye SVGs are toggled via CSS
        });
    }

    // ===== Google Sign-In =====
    function handleGoogleCredentialResponse(response) {
        showLoading('Signing in with Google...');
        fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
        })
        .then(async (res) => {
            const data = await res.json();
            if (res.ok && data.access_token) {
                localStorage.setItem('token', data.access_token);
                await notify({
                    type: "success",
                    title: "Welcome back",
                    text: "You have been logged in with Google."
                });
                window.location.href = ROUTES.HOME;
            } else {
                await notify({
                    type: "error",
                    title: "Google Sign-In failed",
                    text: data.detail || "Could not sign in with Google. Please try again."
                });
            }
        })
        .catch(async (error) => {
            console.error(error);
            await notify({
                type: "error",
                title: "Connection error",
                text: "Could not connect to server. Please try again."
            });
        })
        .finally(() => {
            hideLoading();
        });
    }

    function initGoogleSignIn() {
        if (typeof google === 'undefined' || !google.accounts) {
            setTimeout(initGoogleSignIn, 200);
            return;
        }
        // Fetch the client ID from the backend config
        fetch(`${API_URL}/auth/google/config`)
            .then(res => res.json())
            .then(config => {
                if (config.client_id && config.client_id !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
                    google.accounts.id.initialize({
                        client_id: config.client_id,
                        callback: handleGoogleCredentialResponse
                    });
                    google.accounts.id.renderButton(
                        document.getElementById('google_signin_button'),
                        {
                            theme: 'filled_black',
                            size: 'large',
                            shape: 'pill',
                            text: 'continue_with',
                            width: '100%',
                            logo_alignment: 'left',
                            locale: 'en'
                        }
                    );
                } else {
                    // Hide Google button if not configured
                    const wrapper = document.querySelector('.google-btn-wrapper');
                    const divider = document.querySelector('.auth-divider');
                    if (wrapper) wrapper.style.display = 'none';
                    if (divider) divider.style.display = 'none';
                }
            })
            .catch(() => {
                // If endpoint doesn't exist or fails, hide the Google button
                const wrapper = document.querySelector('.google-btn-wrapper');
                const divider = document.querySelector('.auth-divider');
                if (wrapper) wrapper.style.display = 'none';
                if (divider) divider.style.display = 'none';
            });
    }

    initGoogleSignIn();
});  