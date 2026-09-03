    import { API_URL, confirmDialog } from "./config.js?v=20260818";
    document.addEventListener('DOMContentLoaded', function() {
    const authLink=document.getElementById("auth-link");
    const token=localStorage.getItem("token");


    
    function showLogin() { authLink.textContent = "Login"; } 
    function showLogout() { authLink.textContent = "Sign Out"; authLink.href="#" }
    async function checkLogin() {
    const token = localStorage.getItem("token");

    if (!token) {
        showLogin();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/user/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (response.ok) {
            showLogout();
        } else {
            localStorage.removeItem("token");
            showLogin();
        }
    } catch (error) {
        console.error(error);
        showLogin();
    }



}


  authLink.addEventListener("click", async function (e) {

    if (authLink.textContent === "Sign Out") {
    const confirmed = await confirmDialog({
        title: "Sign Out",
        text: "You cannot access blogs while signed out.",
        confirmText: "Confirm",
        cancelText: "Cancel"
    });
    if (!confirmed) return;

        e.preventDefault();
        localStorage.removeItem("token");
        localStorage.removeItem("admin_token");
        window.location.reload();
    }
});




checkLogin()
});



