import { API_URL,ROUTES } from "./config.js";
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
                await Swal.fire({
    icon: "success",
    title: "Success!",
    text: "Verification code sent to your email."
});
                localStorage.setItem("pending_email", userEmail);
                window.location.href = "/verify";;
            
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