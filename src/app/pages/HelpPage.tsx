import { Navigation } from "../components/Navigation";

export function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Help</h1>
          <p className="mt-2 text-gray-600">Feature guide and answers for running a legislative simulation.</p>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Classes</h2>
            <p className="mt-2 text-gray-700">
              Teachers create classes, invite co-teachers, set class rules, manage student rosters, and guide the class timeline. Students join with a class code and work inside the active class they are enrolled in.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Organizations</h2>
            <p className="mt-2 text-gray-700">
              Parties, committees, and caucuses organize student work. Teachers can configure which organizations exist, assign committee membership, manage roles, and open or close individual organization elections.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Legislation</h2>
            <p className="mt-2 text-gray-700">
              Students draft bills, submit them, and track them through referral, markup, committee reporting, calendaring, floor consideration, and final action. Teachers can refer bills to committees and calendar reported bills.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Committee Work</h2>
            <p className="mt-2 text-gray-700">
              Committee members can review referred bills, collaboratively mark up text, propose bills for vote, write committee reports, and vote in real time. Posted reports become available from the bill page.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Elections</h2>
            <p className="mt-2 text-gray-700">
              Teachers can open and close voting without posting results. Posting results finalizes the election and applies the winners where the simulation tracks leadership roles.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Profiles and Letters</h2>
            <p className="mt-2 text-gray-700">
              Student profiles show representation, written responses, legislation, organizations, and Dear Colleague activity. Teachers can edit the profile layout for the class and write example profile responses as sample work.
            </p>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">FAQ</h2>
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900">What if I want my classes to share legislation, committees, caucuses, or other class materials?</h3>
              <p className="mt-2 text-gray-700">
                Shared materials across separate classes are not available. If you want all students to see and work with the same legislation, committees, caucuses, announcements, and calendar, enroll those students in one class. Everyone in that class will share the same simulation workspace.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
