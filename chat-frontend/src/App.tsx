import React from 'react';
import { WebSocketProvider } from './context/WebSocketContext';
import { ChatRoot } from './components/ChatRoot';

export const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <ChatRoot />
    </WebSocketProvider>
  );
};

export default App;

