import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./utils/AuthContext";
import { Toaster } from "./components/ui/sonner";
import { DemoAccountSwitcher } from "./components/DemoAccountSwitcher";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <DemoAccountSwitcher />
      <Toaster />
    </AuthProvider>
  );
}
