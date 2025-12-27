import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

// Disable context menu in production to prevent 'Reload' and other browser defaults
if (window.location.hostname !== 'localhost') {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
