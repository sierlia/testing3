import { HelpContactForm } from "../components/HelpContactForm";
import { PublicPage } from "../components/PublicLayout";

export function AboutPage() {
  return (
    <PublicPage active="about">
      <main className="bg-[#fbfaf7]">
        <section className="border-b border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700">About</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">About Gavel</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
              Gavel is built for classroom legislative simulations that need more structure than shared documents,
              spreadsheets, and scattered class messages can provide.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">About the creator</h2>
            <div className="mt-4 space-y-4 text-base leading-7 text-slate-700">
              <p>
                This space is reserved for the creator biography: background, teaching or civic education experience,
                why Gavel was made, and how the project should be contacted or credited.
              </p>
              <p>
                Add a short personal note here when the public copy is ready. The rest of the page is intentionally
                simple so the creator section can be updated without redesigning the site.
              </p>
            </div>
          </article>

          <HelpContactForm
            title="Contact"
            description="Send a question, support request, or note about using Gavel."
            submitLabel="Send message"
          />
        </section>
      </main>
    </PublicPage>
  );
}
