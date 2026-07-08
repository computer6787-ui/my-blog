const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";

document.addEventListener('DOMContentLoaded', function() {
    const loginform = document.getElementById('login_form');
    loginform.addEventListener('submit',async function(event) {
        event.preventDefault(); 

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;   

        const response =await fetch(`${API_URL}/login`,{
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
        const token = localStorage.getItem("token")
        if(response.status==200){
            await Swal.fire({
            icon: "success",
            title: "Success!",
             text: "You have been logged in successfully."
});
            window.location.href = "/frontend/index.html";
        }
        
        if(response.status==404 || response.status==400){
            await Swal.fire({
    icon: "error",
    title: "Invalid request",
    text: "You have entered your Password or Gmail wrong"
});
            localStorage.removeItem("token")
            window.location.reload();
        }

    });
});  