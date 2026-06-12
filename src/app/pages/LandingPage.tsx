import { Link } from "react-router";
import { useState } from "react";

import { OpenDemoButton, PublicPage } from "../components/PublicLayout";

type FeatureGroup = {
  heading: string;
  body: string;
  items: string[];
};

const studentWork: FeatureGroup[] = [
  {
    heading: "Choose constituencies",
    body: "Students begin by selecting or being assigned the people and place they represent. Constituency information can be used across profiles, member directories, debate, votes, and bill context.",
    items: [
      "District and constituency fields stay attached to each student profile.",
      "Teachers can require constituency selection as part of profile completion.",
      "The member directory and debate views can show party and constituency context.",
    ],
  },
  {
    heading: "Create profiles",
    body: "Profiles collect the identity and written work that a class wants students to maintain during the simulation. Teachers control the layout, section prompts, and whether profile editing is open to all students or selected students.",
    items: [
      "Profile sections can include written responses, legislation, organizations, votes, contributions, and Dear Colleague letters.",
      "Teacher sample profiles can model the kind of response students should write.",
      "Profile work can be attached to assignments and checked by auto-graded requirements.",
    ],
  },
  {
    heading: "Write bills",
    body: "Students can draft, save, submit, and track legislation inside the same class workspace. Bill pages preserve the original text, supporting text, cosponsors, committees, action history, reports, votes, and final status.",
    items: [
      "Bill drafting supports formatted text and teacher-configurable PDF uploads.",
      "Students can save drafts before submitting final text.",
      "Cosponsorship rules can be open, limited, or tied to the bill timeline.",
    ],
  },
];

const organizations: FeatureGroup[] = [
  {
    heading: "Parties",
    body: "Parties give students a shared coalition space. Teachers can seed default parties, allow student-created parties, set approval rules, and choose how party leaders are selected.",
    items: [
      "Party pages include membership, announcements, comments, leaders, and role labels.",
      "Leadership elections can be student-voted or simplified by teacher setup.",
      "Party membership can be required, optional, or restricted by class settings.",
    ],
  },
  {
    heading: "Committees",
    body: "Committees handle the core legislative review process. They can receive referrals, revise bill text, write reports, vote on bills, and move approved bills toward the floor calendar.",
    items: [
      "Teachers can choose default committees, subcommittees, capacities, and assignment modes.",
      "Committee markup can use a collaborative editor or PDF upload, depending on settings.",
      "Reports, votes, chair roles, ranking member roles, and subcommittee work stay connected to the committee.",
    ],
  },
  {
    heading: "Caucuses",
    body: "Caucuses let students organize around issues or coalitions that do not map cleanly to party membership. They have their own membership, leadership, and communication spaces.",
    items: [
      "Teachers can allow student-created caucuses or manage caucuses directly.",
      "Join rules can be open or request-based.",
      "Caucus leaders can moderate membership and posts when those permissions are enabled.",
    ],
  },
  {
    heading: "Media groups",
    body: "Media work can be represented through class records and generated newsletters. Students can cover referrals, committee reports, votes, and ad bids while teachers keep the published record in one place.",
    items: [
      "Records can store newsletters, reports, vote records, letters, and teacher-created entries.",
      "Generated newsletters can summarize referrals, meetings, reported bills, cosponsor changes, fast-moving bills, and advertisements.",
      "Newsletter entries can be opened, previewed, searched, and downloaded as PDFs.",
    ],
  },
  {
    heading: "Lobbyists",
    body: "Lobbyist groups add an optional money and access layer. When enabled, lobbyist groups can receive starting funds, make contributions, bid for newsletter advertisements, and purchase access set by the teacher.",
    items: [
      "Teachers can create lobbyist groups and set free-join or teacher-assigned membership.",
      "Contribution records show who gave money, who received it, and why it was recorded.",
      "Lobbyist group members are kept separate from parties, committees, and caucuses while they are in a lobbyist group.",
    ],
  },
];

const communication: FeatureGroup[] = [
  {
    heading: "Organization boards",
    body: "Parties, committees, caucuses, and lobbyist groups can have message boards on their organization pages. Those boards keep announcements, comments, replies, reactions, and moderation in the same context as membership and leadership.",
    items: [
      "Teachers can enable or disable announcement boards, comments, emotes, and word limits.",
      "Teachers can moderate posts and comments across the class.",
      "Organization leaders can receive role-based permissions for posting, editing, and member management.",
    ],
  },
  {
    heading: "Class discussions",
    body: "The floor discussion area gives the class a shared board for prompts, posts, replies, reactions, and attachments. Teachers can keep a discussion live, archive it, or hide it from students.",
    items: [
      "Discussion posts and replies can attach bills, records, or letters.",
      "Teacher controls can create, edit, reorder, archive, or activate discussion areas.",
      "Discussion activity can count toward auto-graded assignment requirements.",
    ],
  },
  {
    heading: "Dear Colleague letters",
    body: "Dear Colleague letters support formal communication between students and organizations. A sender can address individual students, parties, committees, caucuses, lobbyist groups, or all members when the class allows it.",
    items: [
      "Letters appear in inboxes and can be opened as records of simulation communication.",
      "Organization letter inboxes keep group-directed messages visible to the relevant members.",
      "Letters can be attached to assignments or counted by auto-grading.",
    ],
  },
];

const customization: FeatureGroup[] = [
  {
    heading: "Simulation scope",
    body: "Gavel can be configured for a short unit, a longer mock congress, or a more detailed simulation. Teachers choose which pieces are enabled before students begin working.",
    items: [
      "Bills, organizations, elections, floor sessions, profiles, lobbyists, money, and records can be enabled or simplified.",
      "Quick setup presets give teachers a starting point, and detailed settings can be changed afterward.",
      "Multiple classes stay separate, so each period can use a different rule set.",
    ],
  },
  {
    heading: "Rules and permissions",
    body: "Teacher settings define who can create bills, refer bills, calendar bills, post announcements, edit committees, manage members, vote, and participate in different organization roles.",
    items: [
      "Committee assignment can be preference-based, random, self-join, or teacher-assigned.",
      "Leadership roles can receive specific permissions instead of blanket access.",
      "Join approvals and invitations let teachers control who enters a class.",
    ],
  },
  {
    heading: "Work formats",
    body: "Text and file formats can match the way a class already works. Teachers can choose site editors or PDF uploads for bills, committee revised text, committee reports, and supporting materials.",
    items: [
      "Word limits are configurable for announcements, comments, reports, and profile responses.",
      "Profile layouts can be edited with teacher-defined sections.",
      "Assignments can target the whole class, selected students, or specific organizations.",
    ],
  },
];

const faqs = [
  {
    question: "Is Gavel only for a full mock congress?",
    answer:
      "No. The same class workspace can be simplified for a short civics unit or expanded for a longer simulation with committees, parties, caucuses, lobbyists, newsletters, floor votes, assignments, and records.",
  },
  {
    question: "Can students work without every feature turned on?",
    answer:
      "Yes. Teachers can disable pieces they do not need. A class can use only bills and profiles, or it can add organizations, discussion boards, floor sessions, money, and grading tools as needed.",
  },
  {
    question: "What happens to bills after students submit them?",
    answer:
      "Submitted bills can be referred to committees, revised, reported, calendared, debated, voted on, and stored with a full action history. Teachers can also use overrides to keep the timeline moving.",
  },
  {
    question: "Does Gavel replace classroom discussion?",
    answer:
      "No. It gives discussion a place to live when the class needs written participation, records, or asynchronous work. Teachers can also disable boards and use Gavel mainly for organization and record keeping.",
  },
  {
    question: "Can teachers grade from Gavel?",
    answer:
      "Yes. Teachers can create assignments, attach rubrics, use auto-graded requirements, review submissions, return feedback, and queue scores for supported gradebook integrations.",
  },
  {
    question: "Where can I read the full feature documentation?",
    answer:
      "The Features page is the public help guide. It explains class setup, constituencies, profiles, bills, organizations, communication, floor sessions, records, assignments, grading, and customization.",
  },
];

function FeatureSection({
  id,
  title,
  body,
  groups,
  tone = "bg-white",
}: {
  id: string;
  label?: string;
  title: string;
  body: string;
  groups: FeatureGroup[];
  tone?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 border-b border-slate-200 py-20 ${tone}`}>
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.36fr_0.64fr] lg:px-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
          <p className="mt-5 text-base leading-8 text-slate-700">{body}</p>
        </div>

        <div className="flex snap-x gap-4 overflow-x-auto border-y border-slate-200 py-5">
          {groups.map((group) => (
            <div key={group.heading} className="min-w-[18rem] max-w-sm snap-start border-r border-slate-200 pr-4 last:border-r-0">
              <h3 className="text-lg font-black text-slate-950">{group.heading}</h3>
              <div>
                <p className="text-base leading-7 text-slate-700">{group.body}</p>
                <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-blue-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Hero() {
  const anchors = [
    ["Representation", "student-work"],
    ["Organizations", "organizations"],
    ["Communication", "communication"],
    ["Customization", "customization"],
    ["Grading", "grading"],
  ];

  return (
    <section className="border-b border-slate-200 bg-blue-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Mock Congress, from first bill to final grade.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-9 text-slate-700">
            Gavel is a teacher-run workspace for mock congress with constituency selection, student profiles, bill drafting,
            organizations, discussion, floor procedure, records, assignments, grading, and more. The page below walks through 
            the feature areas in order, from representation and legislation through organizations, communication, 
            customization, grading, and common questions.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <OpenDemoButton className="px-6 py-3 text-base" />
            <Link
              to="/help"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-black text-slate-950 hover:bg-slate-50"
            >
              Read Features
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-0 border-y border-slate-200 md:grid-cols-5">
          {anchors.map(([label, id]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="border-b border-slate-200 bg-white/50 px-4 py-4 text-center text-sm font-black text-slate-700 hover:bg-white hover:text-blue-700 md:border-b-0 md:border-r md:last:border-r-0"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function GradingSection() {
  const steps = [
    {
      title: "Create assignments from the simulation work students are already doing.",
      body: "Assignments can target the whole class, selected students, parties, committees, caucuses, or lobbyist groups. Teachers can attach bills, records, or Dear Colleague letters so the prompt points directly to the relevant work.",
    },
    {
      title: "Use rubrics when the work needs judgment.",
      body: "Manual rubrics can include named criteria, descriptions, points, extra credit, late-submission settings, and feedback. Students can see the criteria before submitting, and teachers can return scores with written notes.",
    },
    {
      title: "Use auto-graded requirements when the work is countable.",
      body: "Gavel can count submitted bills, cosponsored bills, completed profiles, selected constituencies, joined organizations, sent letters, committee votes, floor votes, committee preferences, discussion posts, and discussion replies.",
    },
    {
      title: "Review and return work from one place.",
      body: "The teacher view shows assigned students, submissions, attached work, auto-score results, manual scores, returned status, and feedback fields without forcing the teacher to reconstruct participation from separate pages.",
    },
    {
      title: "Queue grade passback when a district integration is configured.",
      body: "Gavel includes gradebook setup fields for Synergy, Schoology, PowerSchool, and Google Classroom. Secrets are referenced by name so sensitive credentials can stay server-side.",
    },
  ];

  return (
    <section id="grading" className="scroll-mt-24 border-b border-slate-200 bg-white py-20">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.36fr_0.64fr] lg:px-8">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Grade work faster.</h2>
          <p className="mt-5 text-base leading-8 text-slate-700">
            Grading in Gavel is organized around the actual artifacts of the simulation rather than around disconnected
            screenshots or manual participation tallies.
          </p>
        </div>
        <ol className="border-y border-slate-200">
          {steps.map((step, index) => (
            <li key={step.title} className="grid gap-4 border-b border-slate-200 py-6 last:border-b-0 md:grid-cols-[4rem_1fr]">
              <span className="font-mono text-sm font-black text-blue-700">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-lg font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-base leading-7 text-slate-700">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0]?.question ?? null);

  return (
    <section id="faq" className="scroll-mt-24 bg-blue-50 py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Common questions</h2>
        <div className="mt-8 divide-y divide-slate-200 overflow-hidden border-y border-slate-200">
          {faqs.map((faq) => {
            const open = openQuestion === faq.question;
            return (
              <div key={faq.question}>
                <button type="button" onClick={() => setOpenQuestion(open ? null : faq.question)} className="flex w-full items-center justify-between gap-4 py-6 text-left text-lg font-black text-slate-950">
                  {faq.question}
                  <span className={`text-blue-700 transition-transform ${open ? "rotate-45" : ""}`}>+</span>
                </button>
                <div className={`grid transition-all duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <p className="pb-6 text-base leading-7 text-slate-700">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="bg-slate-950 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="max-w-2xl text-3xl font-black tracking-tight">Open the demo or create a class workspace.</h2>
        <div className="flex flex-wrap gap-3">
          <OpenDemoButton className="bg-white text-slate-950 hover:bg-slate-100" />
          <Link to="/signup" className="inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-3 text-sm font-black text-white hover:bg-white/10">
            Sign up
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <PublicPage active="home">
      <main>
        <Hero />
        <FeatureSection
          id="student-work"
          title="Constituencies, profiles, and bills"
          body="The first layer of the simulation is student identity and legislative work: who each student represents, what they say about that role, and what legislation they introduce."
          groups={studentWork}
          tone="bg-white"
        />
        <FeatureSection
          id="organizations"
          title="Student organizations"
          body="Gavel supports the organizations that make a legislature feel like a political system rather than a folder of separate assignments."
          groups={organizations}
          tone="bg-blue-50"
        />
        <FeatureSection
          id="communication"
          title="Discussion boards and Dear Colleague letters"
          body="Students can communicate through organization message boards, class discussion boards, and Dear Colleague letters without moving the simulation into unrelated tools."
          groups={communication}
          tone="bg-white"
        />
        <FeatureSection
          id="customization"
          title="As simple or as complex as you need."
          body="The settings area is detailed because different classes need different rules. A teacher can keep the simulation streamlined or make it procedurally rich."
          groups={customization}
          tone="bg-slate-50"
        />
        <GradingSection />
        <FaqSection />
        <CtaBanner />
      </main>
    </PublicPage>
  );
}

export default LandingPage;
