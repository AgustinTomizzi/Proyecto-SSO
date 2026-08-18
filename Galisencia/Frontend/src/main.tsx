import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { ThemeProvider } from "./theme/ThemeContext.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { StoreProvider } from "./data/StoreContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
