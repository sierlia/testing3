import { Link } from "react-router";
import { Gavel } from "lucide-react";
import { HelpContactForm } from "../components/HelpContactForm";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Gavel className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Gavel</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            <Link to="/about" className="text-gray-700 hover:text-gray-900">Contact</Link>
            <Link to="/signin" className="text-gray-700 hover:text-gray-900">Sign In</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Contact</h1>
          <p className="mt-2 text-gray-600">Use this form for questions about the simulation or help using the site.</p>
        </div>
        <HelpContactForm />
      </main>
    </div>
  );
}
