import type { ReactNode } from "react";
import { Navigation } from "../components/Navigation";

const sections = [
  ["getting-started", "Getting Started"],
  ["classes", "Classes"],
  ["dashboard", "Dashboard"],
  ["organizations", "Organizations"],
  ["announcements", "Announcements"],
  ["legislation", "Legislation"],
  ["committees", "Committee Work"],
  ["floor", "Floor"],
  ["profiles", "Profiles"],
  ["letters", "Dear Colleague Letters"],
  ["activity", "Activity and Notifications"],
  ["teacher-tools", "Teacher Tools"],
  ["faq", "FAQ"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-gray-200 py-8 last:border-b-0">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-4 leading-7 text-gray-700">{children}</div>
    </section>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="border-b border-gray-200 pb-6">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">Sierlia Help Guide</h1>
            <p className="mt-3 max-w-3xl text-gray-600">
              This guide explains the class simulation tools, student workflows, teacher controls, organization spaces, bill tracking, elections, floor sessions, profiles, and communication features.
            </p>
          </header>

          <nav className="my-6 rounded-lg border border-gray-200 bg-gray-50 p-4" aria-label="Help sections">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sections</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map(([id, label]) => (
                <a key={id} href={`#${id}`} className="rounded-md px-3 py-2 text-sm font-medium text-blue-700 hover:bg-white hover:text-blue-800">
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <Section id="getting-started" title="Getting Started">
            <p>
              Sierlia runs a classroom legislative simulation. Teachers create and configure classes, then students join with a class code. Each class has its own parties, committees, caucuses, legislation, calendars, elections, profiles, letters, and announcement boards.
            </p>
            <FeatureList
              items={[
                "Teachers start from the teacher dashboard, create a class, configure setup options, invite co-teachers, and guide the simulation timeline.",
                "Students start by joining a class with a class code, then use the dashboard to create bills, visit organizations, cosponsor legislation, write profile sections, and participate in votes.",
                "Only the active class is shown in most student areas. Switch classes from the class menu or settings when you are enrolled in more than one class.",
              ]}
            />
          </Section>

          <Section id="classes" title="Classes">
            <p>
              Classes are separate workspaces. Legislation, organizations, announcements, calendars, and membership do not automatically carry across classes.
            </p>
            <FeatureList
              items={[
                "Teachers can create, rename, and manage classes from Your Classes.",
                "Teacher invitations appear as pending class cards with Accept and Decline. Accepting adds the invited teacher to that class as a teacher.",
                "Students can join a class from settings or the join-class prompt. If approval is enabled, the join request appears in the teacher roster pending tab.",
                "Teachers can enable or disable class joining, copy the join code, approve pending students, remove students, and view class membership.",
                "Class settings include simulation rules, cosponsorship timing, committee assignment behavior, profile layout, setup defaults, and teacher invitations.",
              ]}
            />
          </Section>

          <Section id="dashboard" title="Dashboard">
            <p>
              The dashboard is the main work area for the active class. It highlights next actions, quick links, recent activity, announcements, and calendar information.
            </p>
            <FeatureList
              items={[
                "Student quick links include Create Bill, committees the student belongs to, and caucuses the student belongs to.",
                "Student dashboards show recent announcements, My Bills, cosponsored bills, and a compact calendar preview.",
                "Teacher class dashboards include the class timeline, recent student activity, action links, the student roster, settings, join controls, and upcoming events or deadlines.",
                "The teacher timeline moves through setup, elections, committee assignment when enabled, and referring or calendaring bills.",
                "Recent activity links back to the relevant bill, organization, profile, letter, or announcement whenever possible.",
              ]}
            />
          </Section>

          <Section id="organizations" title="Organizations">
            <p>
              Organizations are the social and procedural structure of the simulation. Parties, committees, and caucuses each have a dashboard, member list, announcement board, and elections where applicable.
            </p>
            <FeatureList
              items={[
                "Parties group students by political affiliation and can hold leadership elections for leader and whip.",
                "Committees review referred bills, mark up text, write reports, and vote on whether to report bills.",
                "Caucuses are interest or coalition groups with membership, announcements, and caucus leadership elections.",
                "Teachers can create, rename, edit, delete, and manage organizations, including member roles and removals.",
                "Organization member lists show role labels for leadership positions. Leadership profile links and reply names are purple; teacher profile links are green.",
                "If committee self-join is disabled, students can submit committee preferences and teachers can assign students to committees.",
              ]}
            />
          </Section>

          <Section id="announcements" title="Announcements">
            <p>
              Announcement boards support organization communication. Posts can have comments, replies, reactions, and teacher moderation.
            </p>
            <FeatureList
              items={[
                "Eligible organization members can post announcements and comment in their organization spaces.",
                "Teachers can post, comment, react, delete announcements, and delete comments anywhere in a class.",
                "Teachers are marked with a green name and teacher indicator. Organization leaders are marked with purple profile links.",
                "Reaction menus close after selection or when clicking elsewhere, and each user can only apply one of the same reaction to a post or comment.",
                "Delete actions use confirmation prompts so posts and comments are not removed accidentally.",
              ]}
            />
          </Section>

          <Section id="legislation" title="Legislation">
            <p>
              Bills move through drafting, introduction, referral, committee markup, reporting, calendaring, floor action, and final status.
            </p>
            <FeatureList
              items={[
                "Students can create bills, write original text and supporting text, submit bills, and track authored bills from My Bills.",
                "All Bills can be searched, filtered, sorted, previewed, opened, and highlighted when authored by the current user.",
                "Bill pages show the bill number, title, sponsor, committees, committee reports, latest action, a horizontal tracker, text tabs, cosponsors, and dated actions.",
                "Before committee amendments, bill text appears as Original Text and Supporting Text. After committee changes, Current or Revised Text appears alongside Original Text and Supporting Text.",
                "Cosponsorship can be limited by teacher setting. Students can cosponsor, withdraw, and cosponsor again without creating duplicates.",
                "Actions record introductions, referrals, markups, reports, calendaring, floor actions, final results, and teacher overrides.",
              ]}
            />
          </Section>

          <Section id="committees" title="Committee Work">
            <p>
              Committee pages use persistent tabs for Dashboard, Review, Vote, and Election when the viewer is a committee member or teacher. Nonmembers see only the public committee dashboard.
            </p>
            <FeatureList
              items={[
                "Review is the workspace for referred bills. Members can open a bill, edit collaboratively, view edited, clean, and original text, and post progress.",
                "The live editor stores one shared edited document for the bill and committee so everyone sees the same current text.",
                "Markup keeps formatting and tracks insertions, highlights, and strikeouts. Clean text removes markup and deleted text.",
                "Any committee member can propose a reviewed bill for vote. Once proposed, editing is locked and the bill moves from Review to Vote.",
                "Vote shows edited, clean, and original text, vote counts, real-time voting, and hoverable vote lists.",
                "Committee reports are collaborative during the vote stage, can be popped out and resized, and become available from the bill page after submission.",
                "Closing the vote prevents further votes. Finalizing sends approved bills toward calendaring and leaves rejected or tabled bills out of the calendar flow.",
              ]}
            />
          </Section>

          <Section id="floor" title="Floor">
            <p>
              The Floor page covers the Speaker of the House election and floor consideration of calendared bills.
            </p>
            <FeatureList
              items={[
                "The Speaker election includes a searchable candidate list, filters, live vote counts, opt-out, open or close controls, and Post Results.",
                "Teachers can switch the floor between election mode and bill mode with a confirmation prompt.",
                "In bill mode, the active calendared bill appears with vote controls above the bill text and a side list of next bills.",
                "Teachers can open and close floor votes, post results, manually enter yea, nay, present, and not-voted counts, or directly choose pass or fail.",
                "Posting floor results closes the vote and finalizes whether the bill passed or failed.",
              ]}
            />
          </Section>

          <Section id="profiles" title="Profiles">
            <p>
              Profiles show identity, class work, legislation, organizations, and Dear Colleague activity. Teacher profiles are styled distinctly and omit student-only district and party fields.
            </p>
            <FeatureList
              items={[
                "Students can edit their display name within the profile name limit and fill out assigned profile response sections.",
                "Teachers can edit the profile layout for all students by adding, renaming, moving, resizing, or deleting sections.",
                "Profile section types include long response, legislation written, organizations, and Dear Colleague letters.",
                "Some profile sections can only be added once. Organization sections stay full width.",
                "Teachers can write example profile responses. Students viewing a teacher profile see those entries marked as sample work.",
                "Deleting a profile section with student work requires confirmation because it permanently removes submitted work.",
              ]}
            />
          </Section>

          <Section id="letters" title="Dear Colleague Letters">
            <p>
              Dear Colleague letters let students and teachers communicate with individuals or groups in the active class.
            </p>
            <FeatureList
              items={[
                "Recipients can be selected from individuals, parties, committees, caucuses, or All Members.",
                "Selected recipients appear in the To field, and the search box filters available recipients.",
                "Party recipient names use Democratic Party, Republican Party, and a Party suffix for other party names.",
                "Profile Send Letter buttons open the composer with the profile owner ready as a recipient.",
              ]}
            />
          </Section>

          <Section id="activity" title="Activity and Notifications">
            <p>
              Activity and notifications help users track changes across the simulation.
            </p>
            <FeatureList
              items={[
                "Notifications can be marked read individually or all at once, and the notification menu closes when clicking elsewhere.",
                "New indicators on committee review and vote tabs clear after unseen bills are opened.",
                "The full activity page can be searched and filtered by student, organization, and activity type, then sorted ascending or descending by time.",
                "Activity entries link to the underlying item whenever there is a destination page.",
              ]}
            />
          </Section>

          <Section id="teacher-tools" title="Teacher Tools">
            <p>
              Teacher tools are designed to keep the simulation moving without forcing every action through the student workflow.
            </p>
            <FeatureList
              items={[
                "Teachers can refer bills to committees, calendar reported bills, manage organizations, assign committees, invite co-teachers, and adjust simulation settings.",
                "Teacher bill timeline overrides are integrated into the bill tracker and use confirmation prompts with appropriate committee or calendar selectors.",
                "Teacher overrides create action history and use green override styling in the action list.",
                "The student roster includes search, student counts, pending approvals when enabled, and a View Activity action for each student.",
                "Calendars show deadlines and scheduled bills. Teachers can add deadlines, manage deadlines, and edit calendared bill times from the appropriate calendar views.",
              ]}
            />
          </Section>

          <Section id="faq" title="FAQ">
            <div>
              <h3 className="font-semibold text-gray-900">What if I want my classes to share legislation, committees, caucuses, or other class materials?</h3>
              <p className="mt-2">
                Shared materials across separate classes are not available. If you want students to work from the same legislation, organizations, announcements, calendar, and simulation history, enroll those students in a single class. Everyone in that class will share the same workspace.
              </p>
            </div>
          </Section>
        </article>
      </main>
    </div>
  );
}
