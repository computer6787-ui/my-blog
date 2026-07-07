console.log('Login script loaded');
document.addEventListener('DOMContentLoaded', function() {
    const loginform = document.getElementById('login_form');
    loginform.addEventListener('submit',async function(event) {
        event.preventDefault(); 

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;   

        const response =await fetch('http://127.0.0.1:8000/login',{
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
        alert("Login successful!");
        window.location.href = "/frontend/index.html";
        

    });
});  