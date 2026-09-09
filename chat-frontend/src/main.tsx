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
    // Force full-width block layout before React mounts into it
    posterRoot.style.cssText = 'width:100%;display:block;overflow:hidden;';
    createRoot(posterRoot).render(
      <SakuraEditorialPoster
        className="w-full block"
        height="clamp(240px, 30vw, 400px)"
        interactiveReveal
        sceneSrc="/static/images/sakura/hero-scene-bg.webp"
        foregroundSrc="/static/images/sakura/hero-branch.webp"
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

