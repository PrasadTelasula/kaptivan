import React from 'react';
import ReactDOM from 'react-dom';

interface TerminalPortalProps {
  children: React.ReactNode;
}

export const TerminalPortal: React.FC<TerminalPortalProps> = ({ children }) => {
  // Create a portal to render the terminal window outside of the ReactFlow context
  return ReactDOM.createPortal(
    children,
    document.body
  );
};