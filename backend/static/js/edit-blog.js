import { API_URL,ROUTES } from "./config.js";
const params = new URLSearchParams(window.location.search);
const id = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded",function(){
    const editForm = document.getElementById("edit-form");
    function autoResize() {
    body.style.height = "auto";
    body.style.height = body.scrollHeight + "px";
}

    body.addEventListener("input", autoResize);



async function loadblog() {
    

const token = localStorage.getItem("token")
    Swal.fire({
    title: "Please Wait...",
    body: "Loading The Edit Page",
    allowOutsideClick: false,
    didOpen: () => {
    Swal.showLoading();
        }
    });
const  response = await fetch(`${API_URL}/blog/${id}`, {  
    headers: {
        Authorization: `Bearer ${token}`
    }
});

const blog = await response.json();
swal.close()

document.getElementById("title").value = blog.title;
document.getElementById("body").value = blog.body;
}
loadblog(); 






async function editblog() {
const token = localStorage.getItem("token")
const title = document.getElementById("title").value;
const body = document.getElementById("body").value;
const  response = await fetch(`${API_URL}/blog/${id}`, {
    method:"PUT",
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
    },
       body: JSON.stringify({
        title: title,
        body: body
    })
});

}


document.getElementById("edit-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const result = await Swal.fire({
        title: "Publish the edited blog?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Confirm",
        cancelButtonText: "Cancel"
    });

    if (!result.isConfirmed) return;

    await editblog();

    await Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Blog edited successfully."
    });

    // Redirect here
    window.location.href = ROUTES.PROFILE;
});




});


