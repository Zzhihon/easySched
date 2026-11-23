import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { MainApp } from "./pages/MainApp";
import { QuickPanel } from "./pages/QuickPanel";

const isQuickPanel = window.location.pathname.startsWith("/quick");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isQuickPanel ? <QuickPanel /> : <MainApp />}</StrictMode>,
);
