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
                await Swal.fire({
                   icon: "success",
                   title: "Success!",
                   text: "Blog created successfully."
});
                 window.location.href = "/frontend/index.html";
            } else if(response.status==401){
                await Swal.fire({
                 icon: "warning",
                  title: "Login Required",
                     text: "Please log in to write a blog."
});
                 window.location.href = "/frontend/login.html";
            }else {
                await Swal.fire({
                 icon: "error",
                    title: "Oops!",
                         text: "Something went wrong"
});
            }

        } catch (error) {
            console.error("Network error:", error);
        }
    }
});