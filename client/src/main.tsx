import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface-raised)",
              color: "var(--text-primary)",
              border: "1px solid rgba(255,255,255,0.7)",
              boxShadow: "5px 5px 12px var(--shadow), -5px -5px 12px var(--highlight)",
              borderRadius: "14px",
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "13px",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
