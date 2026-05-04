import { Link } from "react-router";
import { Gavel } from "lucide-react";
import { HelpContactForm } from "../components/HelpContactForm";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { switchDemoAccount } from "../utils/demoAccounts";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container relative mx-auto flex items-center gap-8 px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Gavel className="h-7 w-7 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Gavel</span>
          </Link>
          <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-6 text-2xl font-bold">
            <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            <Link to="/about" className="text-gray-700 hover:text-gray-900">Contact</Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  await switchDemoAccount("student1", { confetti: true });
                } catch (error: any) {
                  toast.error(error.message || "Could not open demo");
                }
              }}
              className="text-gray-700 hover:text-gray-900"
            >
              Demo
            </button>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm font-medium">
            <Button variant="outline" asChild><Link to="/signin">Sign In</Link></Button>
            <Button asChild><Link to="/signup">Sign Up</Link></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <BackButton className="mb-4" />
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Contact</h1>
          <p className="mt-2 text-gray-600">Use this form for questions about the simulation or help using the site.</p>
        </div>
        <HelpContactForm />
      </main>
    </div>
  );
}
