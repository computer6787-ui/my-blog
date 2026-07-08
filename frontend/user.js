
document.addEventListener("DOMContentLoaded", async function(){
    const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";

const token = localStorage.getItem("token")
if(!token){
    await Swal.fire({
    icon: "warning",
    title: "Login Required",
    text: "Please log in to write a blog."
});
    window.location.href="/frontend/login.html"
}

async function loadUser() {
    const response = await fetch(`${API_URL}/user/me`, {
        method:"GET",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    const user = await response.json();
const container = document.getElementById("published-blogs");

user.blogs.reverse().forEach(blog => {
    const card = document.createElement("div");
    card.className = "personalBlog-card";


    card.innerHTML = `
        <hr>
        <h2>${blog.title}</h2>
        <p>${blog.body.slice(0,70)}...</p>
        <button class="dict_button" onclick="edit_blog(${blog.id})">Edit</button>
               <button class="dict_button" onclick="delete_blog(${blog.id})">
              Delete
            </button>
        <hr>
    `;

    container.appendChild(card);
});


    if (!response.ok) {
     await Swal.fire({
    icon: "error",
    title: "User not found",
    text: "Failed to load user"
});
        return;
    }



    document.getElementById("name").textContent = user.name;
    document.getElementById("email").textContent = user.email;

}

    loadUser();

window.delete_blog = async function(id) {
    const result = await Swal.fire({
    title: "Delete the blog?",
    text: "This action cannot be undone",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel"
});
    if (!result.isConfirmed) return;
    
    console.log(`${API_URL}/blog/${id}`);

    const response = await fetch(`${API_URL}/blog/${id}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (response.ok){
        await Swal.fire({
    icon: "success",
    title: "Success!",
    text: "Blog deleted successfully"
});
    window.location.reload()
    }else{
        await Swal.fire({
    icon: "error",
    title: "Request failed",
    text: "Failed to delete the blog ."
});
    }
}
window.edit_blog=async function(id) {
    window.location.href = `edit-blog.html?id=${id}`;
}
})