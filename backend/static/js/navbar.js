document.addEventListener('DOMContentLoaded', function() {
    const menuBtn = document.getElementById('menu-btn');
    const drawer = document.getElementById('drawer');


    menuBtn.addEventListener('click', function() {
    menuBtn.classList.toggle("open");
    drawer.classList.toggle("open");
});
})