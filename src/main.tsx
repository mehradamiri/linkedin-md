import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Popup } from "@/popup/Popup"
import "@/index.css"

// The popup renders inside whatever Chrome's chrome is set to, so it follows the
// browser's colour scheme rather than shining white at someone in a dark theme.
const scheme = window.matchMedia("(prefers-color-scheme: dark)")
const applyScheme = (dark: boolean) =>
  document.documentElement.classList.toggle("dark", dark)
applyScheme(scheme.matches)
scheme.addEventListener("change", (event) => applyScheme(event.matches))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
