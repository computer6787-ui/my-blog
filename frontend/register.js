document.addEventListener('DOMContentLoaded', function() {
    const name=document.getElementById("username")
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://my-blog-yi3h.onrender.com";

  const userForm = document.getElementById("register");
    

    userForm.addEventListener("submit", createUser);

    async function createUser(event) {
      
        event.preventDefault(); 
        const userName=name.value;
        const userEmail = email.value;
        const userPassword = password.value;
        try {
            const response = await fetch(`${API_URL}/user`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: userName,
                    email: userEmail,
                    password:userPassword
                })
            });

            if (response.ok) {
                await Swal.fire({
    icon: "success",
    title: "Success!",
    text: "Account created successfully."
});
                 window.location.href = "/frontend/login.html";
            
            }else {
               await Swal.fire({
    icon: "error",
    title: "Oops!",
    text: "Something went wrong."
});
            }

        } catch (error) {
            console.error("Network error:", error);
        }
    }
});