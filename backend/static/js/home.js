import { ROUTES, notify } from './config.js?v=20260818';

document.addEventListener('DOMContentLoaded', function() {
    const readBlogsButton = document.getElementById('read_blogs');
    const writeBlogButton = document.getElementById('write_blog');
    const blogSection = document.getElementById('blog_section');

readBlogsButton.addEventListener('click', function() {
     blogSection.scrollIntoView({ behavior: 'smooth' });


});

    writeBlogButton.addEventListener('click', async function() {
        const token = localStorage.getItem("token");
    if (token){
        window.location.href= ROUTES.CREATE_BLOG;
    }else{
        await notify({
             type: "warning",
             title: "Login Required",
             text: "Please log in to write a blog.",
             onClick: () => {
                 window.location.href = ROUTES.LOGIN;
             }
        });
        window.location.href= ROUTES.LOGIN
    }
});



})