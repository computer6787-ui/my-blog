document.addEventListener('DOMContentLoaded', function() {
    const readBlogsButton = document.getElementById('read_blogs');
    const writeBlogButton = document.getElementById('write_blog');
    const blogSection = document.getElementById('blog_section');
    const authLink=document.getElementById("auth");
    const token=localStorage.getItem("token");
    
    const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";
    
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



