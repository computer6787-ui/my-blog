import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountChatApp);
} else {
  mountChatApp();
}

