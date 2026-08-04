    import { API_URL } from "./config.js";
    document.addEventListener('DOMContentLoaded', function() {
    const authLink=document.getElementById("auth-link");
    const token=localStorage.getItem("token");


    
    function showLogin() { authLink.textContent = "Login"; } 
    function showLogout() { authLink.textContent = "Logout"; authLink.href="#" }
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

    if (authLink.textContent === "Logout") {
    const result = await Swal.fire({
    title: "You want to logout?",
    text: "You cannot access blogs while logged out.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel"
});
    if (!result.isConfirmed) return;

        e.preventDefault();
        localStorage.removeItem("token");
        window.location.reload();
    }
});




checkLogin()
});



