document.addEventListener('DOMContentLoaded', function() {
    const readBlogsButton = document.getElementById('read_blogs');
    const writeBlogButton = document.getElementById('write_blog');
    const blogSection = document.getElementById('blog_section');


readBlogsButton.addEventListener('click', function() {
     blogSection.scrollIntoView({ behavior: 'smooth' });


})

    writeBlogButton.addEventListener('click', async function() {
        console.log
    const token = localStorage.getItem("token");
    if (token){
        window.location.href= "/frontend/create-blog.html";
    }else{
        await Swal.fire({
             icon: "warning",
             title: "Login Required",
             text: "Please log in to write a blog."
});
        window.location.href= "/frontend/login.html"
    }
});


})