import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import VerifyAdminEmail from "./VerifyAdminEmail.jsx";
import "./index.css";

// Pantalla independiente, de uso exclusivo para verificación de correo en staging.
// La aplicación principal y las evaluaciones mantienen su funcionamiento anterior.
const isVerificationPage = new URLSearchParams(window.location.search)
  .get("verificar-correo") === "1";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isVerificationPage ? <VerifyAdminEmail /> : <App />}
  </React.StrictMode>
);
