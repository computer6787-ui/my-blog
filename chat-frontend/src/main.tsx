import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { SakuraEditorialPoster } from './components/ui/sakura-editorial-poster';

function mountChatApp() {
  let target = document.getElementById('lumora-chat-root') || document.getElementById('root');
  if (!target) {
    target = document.createElement('div');
    target.id = 'lumora-chat-root';
    document.body.appendChild(target);
  }

  createRoot(target).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

function mountSakuraPoster() {
  const posterRoot = document.getElementById('sakura-poster-root');
  if (posterRoot) {
    createRoot(posterRoot).render(
      <SakuraEditorialPoster
        className="w-full"
        interactiveReveal
        sceneSrc="/static/images/sakura/hero-scene-bg.jpg"
        foregroundSrc="/static/images/sakura/hero-branch.png"
      />
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountChatApp();
    mountSakuraPoster();
  });
} else {
  mountChatApp();
  mountSakuraPoster();
}

