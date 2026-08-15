export const API_URL =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://lumora-2g3u.onrender.com";


export const ROUTES = {
    HOME: "/",
    LOGIN: "/login",
    PROFILE: "/user",
    CREATE_BLOG: "/create-blog"
};

