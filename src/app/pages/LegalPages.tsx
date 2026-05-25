import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";

import { PublicPage } from "../components/PublicLayout";

const updated = "May 25, 2026";

function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [title]);

  return (
    <PublicPage active="legal" className="bg-white">
      <main className="bg-white">
        <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="pb-8">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
            <p className="mt-4 text-sm font-semibold text-slate-500">Last updated: {updated}</p>
          </header>
          <div className="space-y-10 text-base leading-8 text-slate-700">{children}</div>
        </article>
      </main>
    </PublicPage>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-3 h-1.5 w-1.5 flex-none rounded-full bg-blue-600" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <Section title="1. Scope and Roles">
        <p>
          Gavel is an educational web application for classroom legislative simulations. In a school setting, the school,
          district, teacher, or other educational institution generally controls the class workspace and decides how Gavel is
          used. Gavel processes student information to provide the service requested by that educational institution.
        </p>
        <p>
          When a teacher, school, or district provides Gavel to students, Gavel treats student information as school-controlled
          educational information and uses it only to operate, secure, support, and improve the classroom service described in
          this policy.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <PolicyList
          items={[
            "Account information, such as name, email address, authentication identifiers, role, and class membership.",
            "Profile information, such as display name, constituency, party, avatar, class role, written profile responses, and teacher-created profile sections.",
            "Simulation content, such as bills, draft bills, supporting text, committee revisions, reports, votes, cosponsorships, calendars, floor activity, speaker requests, previous-question votes, and final bill statuses.",
            "Organization information, such as party, committee, caucus, lobbyist group, membership, leadership, preferences, announcements, comments, reactions, and organization letters.",
            "Communication content, such as Dear Colleague letters, organization board posts, class discussion posts, replies, attachments, and support messages submitted through contact forms.",
            "Assignment and grading information, such as assignment prompts, rubrics, auto-graded criteria, submissions, attachments, scores, feedback, returned status, and configured gradebook integration targets.",
            "Records and media-style artifacts, such as custom records, generated newsletters, vote records, campaign contribution records, advertisement bids, and downloadable newsletter metadata.",
            "Files uploaded by users, such as PDFs used for bills, committee reports, discussion attachments, assignment attachments, or simulation resources.",
            "Technical information, such as device and browser information, log data, authentication session state, local preferences, security events, and approximate usage information necessary to operate the service.",
          ]}
        />
      </Section>

      <Section title="3. How We Use Information">
        <PolicyList
          items={[
            "To create and manage class workspaces, accounts, memberships, roles, permissions, and authentication.",
            "To display simulation content to class members according to teacher settings and role-based permissions.",
            "To support bill drafting, committees, organizations, floor sessions, discussion boards, records, assignments, grading, notifications, and demo access.",
            "To help teachers evaluate participation and submitted work, including through rubrics and auto-graded requirements.",
            "To maintain safety, reliability, security, auditability, data integrity, and abuse prevention.",
            "To respond to support requests and contact form submissions.",
            "To improve usability, fix bugs, and maintain the educational service. Student information is not used for behavioral advertising.",
          ]}
        />
      </Section>

      <Section title="4. How Information Is Shared">
        <p>
          Class information is shared inside the class workspace according to the settings selected by the teacher or school.
          For example, a student's bill, profile, committee vote, discussion post, or organization announcement may be visible
          to classmates when that feature is part of the simulation.
        </p>
        <PolicyList
          items={[
            "Teachers and authorized co-teachers can view and manage class content, student submissions, grades, and records for their classes.",
            "Class members can view content that the class workflow makes visible to them, such as public bills, profiles, organization pages, discussions, records, and floor activity.",
            "Service providers may process information only as needed to host, secure, store, authenticate, or deliver the app.",
            "Gradebook integrations may receive scores or related assignment data only when configured by an authorized teacher or school.",
            "Information may be disclosed when required by law, to protect rights and safety, or to enforce applicable terms.",
          ]}
        />
      </Section>

      <Section title="5. Student Privacy">
        <p>
          Gavel does not sell student personal information and does not use student personal information for targeted
          advertising. Student data is used to provide the educational service, support teacher-directed classroom workflows,
          and maintain the security and reliability of the app.
        </p>
        <p>
          Parents, guardians, and eligible students should direct requests to inspect, correct, export, or delete education
          records to the school or teacher that controls the class. Gavel will support the school or teacher in responding to
          those requests as appropriate.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          Gavel uses authentication, role-based access controls, class scoping, row-level database policies, private storage
          controls for protected files, and other administrative and technical safeguards intended to protect information from
          unauthorized access. No online service can guarantee perfect security, but the app is designed to limit access by
          class, role, and feature permission.
        </p>
      </Section>

      <Section title="7. Retention and Deletion">
        <p>
          Information is retained while needed to provide the class workspace, maintain records selected by teachers, comply
          with legal obligations, resolve disputes, and support security. Teachers or schools may request deletion of class
          information or account information through the contact form, subject to technical limitations, backup retention, and
          legal requirements.
        </p>
      </Section>

      <Section title="8. Choices and Rights">
        <PolicyList
          items={[
            "Users can edit many profile and account fields inside the app when their role and class settings allow it.",
            "Teachers can configure visibility, permissions, profile fields, organization access, discussion settings, and assignment requirements.",
            "Users can control browser storage through browser settings, though disabling essential storage can prevent sign-in and core app functions.",
            "Schools may request access, correction, export, or deletion for their controlled class data through the contact form.",
          ]}
        />
      </Section>

      <Section title="9. Contact">
        <p>
          Questions about this policy can be submitted through the <Link to="/about" className="font-semibold text-blue-700 hover:text-blue-800">About page contact form</Link>.
          Students and families should also contact their teacher or school for questions about class-controlled education
          records.
        </p>
      </Section>
    </LegalShell>
  );
}

export function TermsOfUsePage() {
  return (
    <LegalShell title="Terms of Use">
      <Section title="1. Acceptance">
        <p>
          By accessing or using Gavel, you agree to these Terms of Use and to the policies linked from the footer. If you use
          Gavel on behalf of a school, district, or organization, you represent that you are authorized to accept these terms
          for that organization or to use the service under that organization's direction.
        </p>
      </Section>

      <Section title="2. Educational Use">
        <p>
          Gavel is provided for educational simulation, classroom management, and related school activities. It is not a real
          legislative filing system, legal advice service, campaign finance system, or official government record system.
          Classroom votes, bills, contributions, and records are simulation artifacts unless a teacher clearly states otherwise
          for class purposes.
        </p>
      </Section>

      <Section title="3. Accounts and Responsibilities">
        <PolicyList
          items={[
            "Users must provide accurate account information and keep sign-in credentials secure.",
            "Teachers are responsible for configuring class settings, invitations, permissions, student access, and assignment expectations.",
            "Students must use Gavel only for authorized class activity and follow teacher, school, and district rules.",
            "Users are responsible for content they create, upload, post, submit, or send through Gavel.",
          ]}
        />
      </Section>

      <Section title="4. Acceptable Use">
        <PolicyList
          items={[
            "Do not use Gavel to harass, threaten, discriminate, bully, impersonate others, or post content that violates school policy or law.",
            "Do not attempt to access another class, account, file, grade, private message, or record without authorization.",
            "Do not upload malware, exploit vulnerabilities, disrupt service, scrape data at scale, or bypass authentication or permissions.",
            "Do not post private personal information about others unless it is authorized and necessary for the class activity.",
            "Do not use Gavel for targeted advertising, commercial solicitation to students, or non-educational data collection.",
          ]}
        />
      </Section>

      <Section title="5. User Content">
        <p>
          Users keep ownership of content they create, subject to the rights needed for Gavel to host, display, process, secure,
          back up, and provide that content inside the app. When content is created inside a school-controlled class, the school
          or teacher may have rights to access, moderate, archive, export, or delete that content according to school policy and
          applicable law.
        </p>
      </Section>

      <Section title="6. Teacher and School Controls">
        <p>
          Teachers and authorized school users may configure features, moderate posts, manage membership, review letters and
          submissions, grade work, export records, and remove content where the app and class settings allow it. Teachers should
          configure Gavel consistently with school policies, student privacy obligations, accessibility requirements, and class
          expectations.
        </p>
      </Section>

      <Section title="7. Integrations and Third-Party Services">
        <p>
          Gavel may include fields or workflows for gradebook integrations, authentication, hosting, storage, and other service
          providers. A teacher or school is responsible for ensuring that any integration is authorized by the school and
          configured correctly. Gavel is not responsible for third-party systems outside its control.
        </p>
      </Section>

      <Section title="8. Demo Access">
        <p>
          Demo accounts are provided so visitors can inspect the product. Demo content may be reset, changed, or removed.
          Users should not enter real student information, confidential school information, or sensitive personal information
          into demo accounts.
        </p>
      </Section>

      <Section title="9. Availability and Changes">
        <p>
          Gavel may change features, settings, documentation, policies, or availability over time. The service may be
          interrupted for maintenance, security updates, hosting issues, or technical problems. Gavel may suspend or restrict
          access when needed to protect users, comply with law, or enforce these terms.
        </p>
      </Section>

      <Section title="10. Disclaimers and Limits">
        <p>
          Gavel is provided as an educational tool. To the extent permitted by law, the service is provided without warranties
          of uninterrupted availability, error-free operation, fitness for a particular purpose, or compatibility with every
          school system. To the extent permitted by law, Gavel is not liable for indirect, incidental, consequential, special,
          punitive, or exemplary damages.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about these terms can be submitted through the <Link to="/about" className="font-semibold text-blue-700 hover:text-blue-800">About page contact form</Link>.
        </p>
      </Section>
    </LegalShell>
  );
}

export function CookiePolicyPage() {
  return (
    <LegalShell title="Cookie Policy">
      <Section title="1. Summary">
        <p>
          Gavel uses essential browser storage to keep users signed in, remember settings, operate demo access, preserve local
          preferences, and protect the service. Gavel does not use advertising cookies and does not use cookies for behavioral
          advertising.
        </p>
      </Section>

      <Section title="2. Types of Storage Used">
        <PolicyList
          items={[
            "Authentication and session storage keeps a user signed in and helps route the user to the correct class or dashboard.",
            "Preference storage remembers interface choices such as active class, cached class information, notification state, sidebar state, records view mode, and cookie consent choice.",
            "Demo storage supports demo account switching, demo status, and demo launch progress.",
            "Security and reliability storage helps prevent inconsistent state, restore navigation, and keep the app usable across refreshes.",
            "Uploaded files and class data are stored in the application's backend storage and database, not merely in browser cookies.",
          ]}
        />
      </Section>

      <Section title="3. Essential vs. Optional">
        <p>
          Browser storage used by Gavel is essential to core app functionality. The banner confirms that essential storage is
          in use. Gavel does not add nonessential advertising or analytics cookies through that banner. Because the app relies
          on essential storage for sign-in, class access, preferences, and security, disabling that storage in the browser can
          prevent the service from working correctly.
        </p>
      </Section>

      <Section title="4. Browser Controls">
        <p>
          You can block or delete cookies and local storage through your browser settings. Doing so may sign you out, remove
          saved preferences, interrupt demo access, reset interface choices, or prevent parts of the application from working
          correctly.
        </p>
      </Section>

      <Section title="5. Third-Party Cookies">
        <p>
          Gavel may use service providers for hosting, authentication, database, storage, or related infrastructure. Those
          providers may use necessary storage to provide their services. Gavel does not intentionally place third-party
          advertising cookies.
        </p>
      </Section>

      <Section title="6. Changes and Contact">
        <p>
          This policy may be updated when storage practices change. Questions can be submitted through the <Link to="/about" className="font-semibold text-blue-700 hover:text-blue-800">About page contact form</Link>.
        </p>
      </Section>
    </LegalShell>
  );
}

export function FerpaCoppaCompliancePage() {
  return (
    <LegalShell title="FERPA/COPPA Compliance">
      <Section title="1. FERPA Role">
        <p>
          When Gavel is used by a school, district, teacher, or educational institution, Gavel is intended to act as a service
          provider processing education records at the direction of that institution. The school or district remains responsible
          for deciding whether and how Gavel is used, which students participate, which data is entered, and how records are
          handled under its own FERPA policies.
        </p>
        <p>
          Gavel uses student information only for authorized educational purposes, including class management, simulation
          participation, assignments, grading, records, communication, security, support, and service operation. Gavel does not
          sell student information or use student information for targeted advertising.
        </p>
      </Section>

      <Section title="2. Education Records and Access">
        <PolicyList
          items={[
            "Teachers and authorized co-teachers can access class records, student profiles, submissions, grades, letters, discussions, votes, and organization work for their classes.",
            "Students can access class content made visible by the teacher's settings and by the normal simulation workflow.",
            "Parents, guardians, and eligible students should direct requests to inspect, correct, or delete education records to the school or district that controls the class.",
            "Gavel will support school-directed access, correction, export, and deletion requests where technically feasible and legally appropriate.",
          ]}
        />
      </Section>

      <Section title="3. FERPA Safeguards">
        <PolicyList
          items={[
            "Class-scoped data limits users to the active class workspace unless a teacher or school grants broader access.",
            "Role-based permissions distinguish teachers, students, organization leaders, committee members, lobbyist group members, and other simulation roles.",
            "Database row-level security and private storage controls are used to limit access to protected records and files.",
            "Teacher settings control visibility for organizations, boards, discussions, profiles, assignments, grades, and workflow actions.",
            "Support and service providers are expected to handle information only as needed to provide, secure, and maintain the service.",
          ]}
        />
      </Section>

      <Section title="4. COPPA and Children Under 13">
        <p>
          Gavel is designed for school-directed educational use. If students under 13 use Gavel, the school or teacher should
          authorize that use and provide any notices or consents required by COPPA and district policy. Gavel does not knowingly
          invite children under 13 to create accounts for non-school personal use.
        </p>
        <PolicyList
          items={[
            "Information from students under 13 is used only to provide the classroom service requested by the school or teacher.",
            "Gavel does not use student information for targeted advertising or sell student personal information.",
            "Parents should contact the school to review, correct, or request deletion of information submitted by a child in a school-controlled class.",
            "Schools should avoid entering unnecessary sensitive personal information and should configure class settings consistently with their own policies.",
          ]}
        />
      </Section>

      <Section title="5. Data Minimization and Retention">
        <p>
          Gavel collects the information needed to run classroom legislative simulations, maintain class records, support
          assignments and grades, and secure the service. Teachers and schools should use profile prompts, assignments,
          discussion boards, and records in ways that are appropriate for the age of students and the educational purpose of the
          class. Data can be deleted or exported upon school-directed request where technically feasible and legally appropriate.
        </p>
      </Section>

      <Section title="6. School Responsibilities">
        <PolicyList
          items={[
            "Determine whether Gavel is approved for school use and whether any district agreement or notice is required.",
            "Provide required notices and obtain required consents for students, including students under 13 when applicable.",
            "Configure class settings, visibility, profile prompts, assignments, and integrations appropriately.",
            "Respond to parent, guardian, and eligible student requests under FERPA, COPPA, and local policy.",
            "Avoid asking students to submit unnecessary sensitive information in profiles, letters, discussions, assignments, or uploaded files.",
          ]}
        />
      </Section>

      <Section title="7. Contact">
        <p>
          Schools can submit FERPA, COPPA, privacy, access, correction, export, or deletion questions through the <Link to="/about" className="font-semibold text-blue-700 hover:text-blue-800">About page contact form</Link>.
        </p>
      </Section>
    </LegalShell>
  );
}
