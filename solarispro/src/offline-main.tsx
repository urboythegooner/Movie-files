import React from "react";
import { createRoot } from "react-dom/client";
import SolarisGame from "./game/SolarisGame";
import "./styles.css";

document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SolarisGame />
  </React.StrictMode>,
);
