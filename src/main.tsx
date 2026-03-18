import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PrefsApp from "./PrefsApp";
import "./App.css";

// Disable context menu in production to prevent 'Reload' and other browser defaults
if (window.location.hostname !== 'localhost') {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

const params = new URLSearchParams(window.location.search);
const isPrefsWindow = params.get("window") === "prefs";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPrefsWindow ? <PrefsApp /> : <App />}
  </React.StrictMode>,
);
