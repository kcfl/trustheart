import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import StartupPreloader from "./components/StartupPreloader";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StartupPreloader>
      <App />
    </StartupPreloader>
  </React.StrictMode>,
);
