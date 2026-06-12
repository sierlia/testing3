import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { isOAuthCallbackLocation, oauthHashRouteUrl, processOAuthRedirectFromLocation } from "./app/utils/oauthSignup";
import "./styles/index.css";

async function bootstrap() {
  if (isOAuthCallbackLocation()) {
    try {
      const session = await processOAuthRedirectFromLocation();
      if (session) window.history.replaceState({}, document.title, oauthHashRouteUrl("/"));
    } catch {
      // The React callback route will show the user-facing error without logging token-bearing URLs.
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
