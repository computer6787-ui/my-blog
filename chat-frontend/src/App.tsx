import React from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { WebSocketProvider } from './context/WebSocketContext';
import { ChatRoot } from './components/ChatRoot';
import { ChatPage } from './components/ChatPage';

const AppShell: React.FC = () => {
  const location = useLocation();
  const isFullPageChat = location.pathname.startsWith('/chat');

  if (isFullPageChat) {
    return <ChatPage />;
  }

  return <ChatRoot />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <WebSocketProvider>
        <AppShell />
      </WebSocketProvider>
    </BrowserRouter>
  );
};

export default App;
