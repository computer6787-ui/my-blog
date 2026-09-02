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
        const monkey = document.getElementById('monkeyFigure');
        togglePassword.addEventListener('click', function(event) {
            event.preventDefault();
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.textContent = type === 'password' ? '🙈' : '🙉';
            if (monkey) monkey.classList.toggle('monkey--revealed', type === 'text');
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
                    title: "Welcome!",
                    text: "You have been registered and logged in with Google."
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