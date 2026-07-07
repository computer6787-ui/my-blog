document.addEventListener('DOMContentLoaded', function() {
    const readBlogsButton = document.getElementById('read_blogs');
    const writeBlogButton = document.getElementById('write_blog');
    const blogSection = document.getElementById('blog_section');
    const authLink=document.getElementById("auth");
    const token=localStorage.getItem("token");

    readBlogsButton.addEventListener('click', function() {
        blogSection.scrollIntoView({ behavior: 'smooth' });

});
    writeBlogButton.addEventListener('click', function() {
        window.location.href= "/frontend/create-blog.html";
});
    if (token) {
    authLink.textContent = "Logout";
    authLink.href = "#";

    authLink.addEventListener("click", function (event) {
        event.preventDefault();

        localStorage.removeItem("token");
        alert("You have been logged out")

        window.location.href = "/frontend/index.html";
    });
}

})