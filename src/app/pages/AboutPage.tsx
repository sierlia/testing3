import { HelpContactForm } from "../components/HelpContactForm";
import { BackButton } from "../components/BackButton";
import { PublicNav } from "./LandingPage";

export function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNav active="contact" />
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
