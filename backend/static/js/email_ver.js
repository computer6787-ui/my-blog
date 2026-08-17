import { API_URL,ROUTES } from "./config.js";
document.addEventListener('DOMContentLoaded', function() {
    const email = document.getElementById("email");


  const userForm = document.getElementById("reset_pass_form");
    

    userForm.addEventListener("submit", createUser);

    async function createUser(event) {
      
        event.preventDefault(); 
        const userEmail = email.value;
        try {
            const response = await fetch(`${API_URL}/user/ver_email`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: userEmail
                })
            });

            if (response.ok) {
                await Swal.fire({
    icon: "success",
    title: "Success!",
    text: "Verification code sent to your email."
});
                localStorage.setItem("userEmail", userEmail);
                window.location.href = "/Verify_user";;
            
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