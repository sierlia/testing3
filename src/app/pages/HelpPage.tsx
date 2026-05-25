import type { ReactNode } from "react";

import { HelpContactForm } from "../components/HelpContactForm";
import { PublicPage } from "../components/PublicLayout";

const sections = [
  ["overview", "Overview"],
  ["classes", "Classes"],
  ["constituencies-profiles", "Constituencies and Profiles"],
  ["bills", "Bills"],
  ["committees", "Committees"],
  ["organizations", "Organizations"],
  ["communication", "Communication"],
  ["floor", "Floor"],
  ["records", "Records and Newsletters"],
  ["assignments", "Assignments and Grading"],
  ["settings", "Customization"],
  ["faq", "FAQ"],
] as const;

function ArticleSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 py-10">
      <h2 className="text-3xl font-black tracking-tight text-slate-950">{title}</h2>
      <div className="mt-5 space-y-5 text-base leading-8 text-slate-700">{children}</div>
    </section>
  );
}

function ParagraphList({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.title}>
          <p>
            <strong className="font-black text-slate-950">{item.title}.</strong> {item.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function HelpPage() {
  return (
    <PublicPage active="features" className="bg-white">
      <main className="bg-white">
        <header className="border-b border-slate-200 bg-blue-50">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-sm font-black uppercase tracking-wide text-blue-700">Features</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Gavel Feature Guide</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
              This guide explains the main classroom workflows in Gavel: class setup, student profiles, legislation,
              organizations, communication, floor procedure, records, assignments, grading, and customization.
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="border-y border-slate-200 py-3" aria-label="Feature sections">
              {sections.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0">
            <ArticleSection id="overview" title="Overview">
              <p>
                Gavel is organized around a class workspace. A teacher creates a class, configures the simulation rules,
                and students join that class. Everything a student does in that workspace is connected to the class: profile
                work, bills, cosponsorships, committee activity, organization membership, letters, discussion posts, votes,
                records, and assignment submissions.
              </p>
              <p>
                The app is intentionally modular. A teacher can use only the pieces needed for a particular course, or run a
                larger simulation with parties, committees, caucuses, lobbyists, media records, newsletters, elections, floor
                votes, assignments, and gradebook integrations.
              </p>
            </ArticleSection>

            <ArticleSection id="classes" title="Classes">
              <p>
                Classes are separate simulation spaces. A bill, organization, discussion board, assignment, or record created
                in one class does not automatically appear in another class. This lets different periods use different
                committees, timelines, rules, and grading structures.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Teacher setup",
                    body: "Teachers create classes from the teacher dashboard, rename and manage those classes, invite co-teachers, copy join codes, approve pending students when approval is enabled, and move between classes from the class switcher.",
                  },
                  {
                    title: "Student joining",
                    body: "Students join with a class code or invitation. If the teacher requires approval, students remain pending until the teacher approves the request. Students enrolled in more than one class can switch classes from settings.",
                  },
                  {
                    title: "Class dashboard",
                    body: "The dashboard acts as the starting point for the active class. It links students to bills, organizations, assignments, announcements, and recent activity, while teachers see setup, roster, timeline, and management controls.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="constituencies-profiles" title="Constituencies and Profiles">
              <p>
                Constituencies and profiles define who students are inside the simulation. A student can represent a district,
                party, or other constituency, and the profile page becomes the public record of that student's identity and work.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Constituency selection",
                    body: "Teachers can require students to select a constituency. Constituency details appear throughout the app where context matters, including member views, floor participation, and profile pages.",
                  },
                  {
                    title: "Profile layout",
                    body: "Teachers can edit the profile layout for the class. Sections can ask for written responses or display work such as authored legislation, cosponsored legislation, organizations, Dear Colleague letters, votes, and contributions received.",
                  },
                  {
                    title: "Profile responses",
                    body: "Students fill out teacher-defined profile prompts. Teachers can provide sample profile responses from their own profile, and assignments can check whether a profile is complete.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="bills" title="Bills">
              <p>
                Bills move from drafting to submission, referral, committee review, reporting, calendaring, floor action, and
                final status. Bill pages show the text, supporting text, sponsor, cosponsors, committees, reports, actions,
                and votes connected to the bill.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Drafting",
                    body: "Students can write formatted bill text in the editor, preview the text, save drafts, and submit when ready. Teachers can configure bill text to use the site editor or PDF upload.",
                  },
                  {
                    title: "Cosponsorship",
                    body: "Students can cosponsor bills when class settings allow it. Teachers can decide whether cosponsorship is always open or limited by the bill's stage in the process.",
                  },
                  {
                    title: "Bill tracking",
                    body: "Each bill has a timeline of actions, including introduction, referral, markup, committee votes, reports, calendaring, floor votes, final results, and teacher overrides. The all-bills view can be searched, filtered, sorted, previewed, and opened.",
                  },
                  {
                    title: "Teacher controls",
                    body: "Teachers can refer bills to one or more committees, calendar reported bills, move work forward with overrides, and delete bills when class management requires it.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="committees" title="Committees">
              <p>
                Committees review referred bills. A committee can have members, chairs, ranking members, subcommittees, an
                announcement board, a markup workspace, votes, reports, and a record of activity tied back to the bill.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Assignment modes",
                    body: "Teachers can let students submit ranked committee preferences, run assignment logic, use random assignment, allow self-join, or assign students manually. Capacity settings help keep committee sizes balanced.",
                  },
                  {
                    title: "Markup",
                    body: "Committee members can revise referred bill text when committee editing is enabled. The committee workspace supports edited text, clean text, original text, reports, voting, and locks when a bill has been proposed for committee vote.",
                  },
                  {
                    title: "Reports and votes",
                    body: "Committees can vote on whether to report a bill. Reports remain attached to the bill, and finalized votes determine whether the bill is eligible for the calendar when the class uses committee voting.",
                  },
                  {
                    title: "Subcommittees",
                    body: "Teachers can enable subcommittees and seed them from configured committee options. Subcommittee work gives classes another layer of review without requiring every simulation to use it.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="organizations" title="Organizations">
              <p>
                Organizations create political structure. Gavel supports parties, committees, caucuses, lobbyist groups, and
                media-style records or newsletters that can be used to simulate coverage and public pressure.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Parties",
                    body: "Parties group students by political affiliation. Teachers can seed default parties, allow student-created parties, require approval, control join restrictions, and choose how party leaders are selected.",
                  },
                  {
                    title: "Caucuses",
                    body: "Caucuses let students organize by issue or coalition. They can have descriptions, member lists, leadership roles, announcements, comments, and join restrictions.",
                  },
                  {
                    title: "Lobbyist groups",
                    body: "Lobbyist groups are optional. When enabled, they can have members, starting balances, contributions, advertisement bids, and access purchases. Their money activity appears in records and can affect class discussion.",
                  },
                  {
                    title: "Media work",
                    body: "Media activity can be represented through records and newsletters. Teachers can generate newsletters from class activity, and students or groups can use records and ad bids to simulate public communication.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="communication" title="Communication">
              <p>
                Communication tools are built into the places where the work happens. Organization boards stay with the
                organization, letters stay connected to their recipients, and class discussions stay connected to floor activity
                and assignment requirements.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Organization message boards",
                    body: "Parties, committees, caucuses, and lobbyist groups can use message boards for announcements and discussion. Teachers can enable boards, comments, reactions, word limits, and role permissions.",
                  },
                  {
                    title: "Dear Colleague letters",
                    body: "Students and teachers can send letters to individuals, organizations, or all members depending on class settings. Organization inboxes collect letters addressed to groups, and letters can be attached to assignments or viewed as records.",
                  },
                  {
                    title: "Class discussion boards",
                    body: "The floor discussion area lets teachers create discussion prompts, choose which prompt is live, archive old prompts, hide prompts from students, and allow posts, replies, reactions, and attachments.",
                  },
                  {
                    title: "Attachments",
                    body: "Discussion posts and assignments can reference existing bills, records, and letters. This keeps written participation connected to the evidence or legislation students are discussing.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="floor" title="Floor">
              <p>
                The floor area supports leadership elections, floor debate, voting, discussion, and a presentation display. A
                class can use the full workflow or keep floor procedure simple.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Elections",
                    body: "The floor can run a Speaker election with candidate search, party filters, vote counts, opt-outs, open and close controls, and posted results. Optional executive or senate-style features can be enabled in settings.",
                  },
                  {
                    title: "Bills on the floor",
                    body: "Calendared bills appear with vote controls, live or posted counts, bill text, next bills, and teacher controls to open votes, close votes, post results, or enter manual counts.",
                  },
                  {
                    title: "Debate management",
                    body: "Students can request to speak for or against a bill when the class uses speaker lists. Teachers can approve requests, assign opposition leaders, show presentation states, and manage motions such as the previous question.",
                  },
                  {
                    title: "Discussion mode",
                    body: "The floor can switch into discussion mode so the class can respond to prompts, attach source material, reply to classmates, and preserve written participation.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="records" title="Records and Newsletters">
              <p>
                Records collect the durable artifacts of the simulation. The records page can include letters, committee
                reports, floor vote records, generated newsletters, campaign contributions, and teacher-created records.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Search and preview",
                    body: "Records can be searched by title, type, author, or text. Teachers and students can filter by type or person, choose preview or open mode, and download generated newsletters as PDFs.",
                  },
                  {
                    title: "Generated newsletters",
                    body: "Teachers can generate newsletters that summarize referrals, committee meetings, committee reports and votes, cosponsor gains, fast-moving bills, and accepted advertisement bids.",
                  },
                  {
                    title: "Teacher-created records",
                    body: "Teachers can add custom records when the class needs a written source, public notice, press item, or archive entry that does not come from another workflow.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="assignments" title="Assignments and Grading">
              <p>
                Assignments connect grading to simulation artifacts. Teachers can create manual or auto-graded assignments,
                target specific audiences, attach class materials, review student submissions, return feedback, and queue
                gradebook sync records when integrations are configured.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "Audience targeting",
                    body: "Assignments can go to all students, selected students, a party, a committee, a caucus, or a lobbyist group. This supports different expectations for different roles.",
                  },
                  {
                    title: "Manual rubrics",
                    body: "Manual grading supports rubric items with descriptions, point values, extra credit, submission notes, attachments, late-submission preferences, and returned feedback.",
                  },
                  {
                    title: "Auto-graded requirements",
                    body: "Auto-grading can count written bills, cosponsored bills, completed profiles, selected constituencies, party membership, committee membership, caucus membership, letters sent, committee votes, floor votes, committee preferences, discussion posts, and discussion replies.",
                  },
                  {
                    title: "Gradebook integrations",
                    body: "Gavel includes setup fields for Synergy, Schoology, PowerSchool, and Google Classroom grade passback. Integration secrets are referenced by name so actual credentials can be stored server-side.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="settings" title="Customization">
              <p>
                The settings area is the control center for the simulation. Teachers can start with a broad setup and then
                refine individual rules as the class develops.
              </p>
              <ParagraphList
                items={[
                  {
                    title: "General structure",
                    body: "Teachers can enable or disable bills, organizations, floor sessions, elections, profiles, lobbyists, money, records, joining rules, and student permissions.",
                  },
                  {
                    title: "Procedural rules",
                    body: "Settings control bill submission, cosponsorship timing, referral authority, committee vote thresholds, floor vote thresholds, speaker signup behavior, live result visibility, and calendar publishing.",
                  },
                  {
                    title: "Organization rules",
                    body: "Teachers can choose default parties, committees, and subcommittees; allow or restrict student-created organizations; configure leadership elections; and set permissions for leaders and members.",
                  },
                  {
                    title: "Formats and limits",
                    body: "Teachers can configure word limits, bill composer format, committee revised text format, committee report format, profile layout, profile editing permissions, announcement boards, and discussion behavior.",
                  },
                ]}
              />
            </ArticleSection>

            <ArticleSection id="faq" title="FAQ">
              <div>
                <h3 className="font-black text-slate-950">Can separate classes share the same simulation?</h3>
                <p className="mt-2">
                  Separate classes do not share work automatically. If students need to work from the same bills,
                  organizations, records, and timeline, enroll them in one class. If periods need different rules or
                  calendars, keep them separate.
                </p>
              </div>
              <div>
                <h3 className="font-black text-slate-950">Can Gavel be used without online discussion?</h3>
                <p className="mt-2">
                  Yes. Teachers can disable organization boards or use them lightly, then rely on Gavel for bills, records,
                  membership, voting, and grading while discussion happens in person.
                </p>
              </div>
              <div>
                <h3 className="font-black text-slate-950">Can students submit work from outside Gavel?</h3>
                <p className="mt-2">
                  Assignments can include manual submission notes and attachments from Gavel work. If a class needs outside
                  documents, teachers can describe that requirement in the prompt and use the rubric fields for grading.
                </p>
              </div>
            </ArticleSection>

            <div className="border-t border-slate-200 py-10">
              <HelpContactForm />
            </div>
          </article>
        </div>
      </main>
    </PublicPage>
  );
}
