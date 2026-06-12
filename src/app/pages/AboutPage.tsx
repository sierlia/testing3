import { HelpContactForm } from "../components/HelpContactForm";
import { PublicPage } from "../components/PublicLayout";

export function AboutPage() {
  return (
    <PublicPage active="about">
      <main className="bg-white">
        <section className="border-b border-slate-200 bg-blue-50">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">About Gavel</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">
              Gavel helps teachers run legislative simulations where student roles, bills, floor activity, records, and assignments stay connected.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Built for classroom mock congress, it keeps the work visible from the first role assignment through the final record.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_18rem] lg:px-8">
          <article className="space-y-8">
            <div className="space-y-4 text-base leading-8 text-slate-700">
              <h2 className="text-2xl font-black text-slate-950">Why Gavel Exists</h2>
              <p>
                Gavel is designed for teachers who want legislative simulations to feel coherent, active, and accountable.
                It keeps students' roles, bills, organizations, floor activity, discussions, records, and assignments in one
                shared workspace instead of scattering the simulation across separate documents and tools.
              </p>
              <p>
                The goal is to make the civic work visible. Students can see what they are responsible for, teachers can
                follow participation without reconstructing it after class, and the whole simulation can be adjusted for a
                short unit or a longer government course.
              </p>
            </div>

            <div className="space-y-4 text-base leading-8 text-slate-700">
              <h2 className="text-2xl font-black text-slate-950">About the Creator</h2>
              <p>
                This space is reserved for the creator biography: background, teaching or civic education experience, why
                Gavel was made, and how the project should be contacted or credited.
              </p>
              <p>
                Add a short personal note here when the public copy is ready. The page is structured so the biography and
                portrait can be updated without redesigning the site.
              </p>
            </div>
          </article>

          <aside className="lg:pt-1">
            <div className="aspect-[4/5] overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100">
              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-slate-500">
                Creator photo
              </div>
            </div>
          </aside>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
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
