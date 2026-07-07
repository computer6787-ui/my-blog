document.addEventListener('DOMContentLoaded', function() {
    const title = document.getElementById("title");
    const body = document.getElementById("body");

    

    const blogForm = document.getElementById("blog_form");
    

    blogForm.addEventListener("submit", createBlog);
    function autoResize() {
    body.style.height = "auto";
    body.style.height = body.scrollHeight + "px";
}

    body.addEventListener("input", autoResize);

// Run once in case there's already text
autoResize();

    async function createBlog(event) {
      
        event.preventDefault(); 

        const blogTitle = title.value;
        const blogBody = body.value;
        const token = localStorage.getItem("token");
        const API_URL =
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";

        try {
            const response = await fetch(`${API_URL}/blog`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: blogTitle,
                    body: blogBody
                })
            });

            if (response.ok) {
                alert("Blog published!")
                 window.location.href = "/frontend/index.html";
            } else if(response.status==401){
                alert("Please log in first");
                 window.location.href = "/frontend/login.html";
            }else {
                alert("Something went wrong")
            }

        } catch (error) {
            console.error("Network error:", error);
        }
    }
});