import { createHashRouter } from "react-router";
import { Root } from "./pages/Root";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { CreateClassPage } from "./pages/CreateClassPage";
import { ClassManagePage } from "./pages/ClassManagePage";
import { ClassDashboard } from "./pages/ClassDashboard";
import { Dashboard } from "./pages/Dashboard";
import { OnboardingPage } from "./components/OnboardingPage";
import { CommitteePreferences } from "./pages/CommitteePreferences";
import { TeacherCommitteeAssignments } from "./pages/TeacherCommitteeAssignments";
import { CommitteeLeadership } from "./pages/CommitteeLeadership";
import { CreateBill } from "./pages/CreateBill";
import { AllBills } from "./pages/AllBills";
import { TessBills } from "./pages/TessBills";
import { MyBills } from "./pages/MyBills";
import { BillDetail } from "./pages/BillDetail";
import { BillPipeline } from "./pages/BillPipeline";
import { TeacherSetup } from "./pages/TeacherSetup";
import { TeacherAdmin } from "./pages/TeacherAdmin";
import { Elections } from "./pages/Elections";
import { Caucuses } from "./pages/Caucuses";
import { TessCaucuses } from "./pages/TessCaucuses";
import { CaucusDetail } from "./pages/CaucusDetail";
import { TessCaucusDetail } from "./pages/TessCaucusDetail";
import { FloorSession } from "./pages/FloorSession";
import { StudentProfile } from "./pages/StudentProfile";
import { EditProfile } from "./pages/EditProfile";
import { Resources } from "./pages/Resources";
import { CommitteeWorkspace } from "./pages/CommitteeWorkspace";
import { CalendarScheduling } from "./pages/CalendarScheduling";
import { LetterView } from "./pages/LetterView";
import { Members } from "./pages/Members";
import { TeacherDeadlines } from "./pages/TeacherDeadlines";
import { DearColleagueInbox } from "./pages/DearColleagueInbox";
import { CreateDearColleagueLetter } from "./pages/CreateDearColleagueLetter";
import { Notifications } from "./pages/Notifications";
import { NotificationSettings } from "./pages/NotificationSettings";
import { SettingsNotifications } from "./pages/SettingsNotifications";
import { SettingsClasses } from "./pages/SettingsClasses";
import { TeacherProfileLayoutEditor } from "./pages/TeacherProfileLayoutEditor";
import { TeacherStudentView } from "./pages/TeacherStudentView";
import { TeacherCaucusManagement } from "./pages/TeacherCaucusManagement";
import { CaucusChairVote } from "./pages/CaucusChairVote";
import { TeacherBillSorting } from "./pages/TeacherBillSorting";
import { NotFoundPage } from "./pages/NotFoundPage";
import { JoinClassPage } from "./pages/JoinClassPage";
import { PartiesPage } from "./pages/PartiesPage";
import { PartyDetail } from "./pages/PartyDetail";
import { CommitteesHome } from "./pages/CommitteesHome";
import { CommitteeDashboard } from "./pages/CommitteeDashboard";
import { ClassSimulationDashboard } from "./pages/ClassSimulationDashboard";

export const router = createHashRouter([
  {
    path: "/",
    Component: Root,
  },
  {
    path: "/signin",
    Component: SignInPage,
  },
  {
    path: "/signup",
    Component: SignUpPage,
  },
  {
    path: "/teacher/dashboard",
    Component: TeacherDashboard,
  },
  {
    path: "/teacher/create-class",
    Component: CreateClassPage,
  },
  {
    path: "/teacher/class/:classId/manage",
    Component: ClassManagePage,
  },
  {
    path: "/teacher/class/:classId",
    Component: ClassDashboard,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
  {
    path: "/join-class",
    Component: JoinClassPage,
  },
  {
    path: "/onboarding",
    Component: OnboardingPage,
  },
  {
    path: "/members",
    Component: Members,
  },
  {
    path: "/class/:classId/dashboard",
    Component: ClassSimulationDashboard,
  },
  {
    path: "/organizations",
    Component: PartiesPage,
  },
  {
    path: "/parties",
    Component: PartiesPage,
  },
  {
    path: "/parties/:id",
    Component: PartyDetail,
  },
  {
    path: "/committees",
    Component: CommitteesHome,
  },
  {
    path: "/committees/:id",
    Component: CommitteeDashboard,
  },
  {
    path: "/committee-preferences",
    Component: CommitteePreferences,
  },
  {
    path: "/teacher/committee-assignments",
    Component: TeacherCommitteeAssignments,
  },
  {
    path: "/committee/:id/leadership",
    Component: CommitteeLeadership,
  },
  {
    path: "/committee/:id/workspace",
    Component: CommitteeWorkspace,
  },
  {
    path: "/bills/create",
    Component: CreateBill,
  },
  {
    path: "/bills",
    Component: TessBills,
  },
  {
    path: "/bills/my",
    Component: MyBills,
  },
  {
    path: "/tess-bills",
    Component: TessBills,
  },
  {
    path: "/bills/:id",
    Component: BillDetail,
  },
  {
    path: "/bill-pipeline",
    Component: BillPipeline,
  },
  {
    path: "/teacher/setup",
    Component: TeacherSetup,
  },
  {
    path: "/teacher/admin",
    Component: TeacherAdmin,
  },
  {
    path: "/elections",
    Component: Elections,
  },
  {
    path: "/caucuses",
    Component: TessCaucuses,
  },
  {
    path: "/tess-caucuses",
    Component: TessCaucuses,
  },
  {
    path: "/caucuses/:id",
    Component: TessCaucusDetail,
  },
  {
    path: "/tess-caucuses/:id",
    Component: TessCaucusDetail,
  },
  {
    path: "/floor-session",
    Component: FloorSession,
  },
  {
    path: "/calendar",
    Component: CalendarScheduling,
  },
  {
    path: "/profile/:id",
    Component: StudentProfile,
  },
  {
    path: "/edit-profile/:id",
    Component: EditProfile,
  },
  {
    path: "/letters/:id",
    Component: LetterView,
  },
  {
    path: "/resources",
    Component: Resources,
  },
  {
    path: "/teacher/deadlines",
    Component: TeacherDeadlines,
  },
  {
    path: "/dear-colleague/inbox",
    Component: DearColleagueInbox,
  },
  {
    path: "/dear-colleague/compose",
    Component: CreateDearColleagueLetter,
  },
  {
    path: "/notifications",
    Component: Notifications,
  },
  {
    path: "/settings/notifications",
    Component: SettingsNotifications,
  },
  {
    path: "/settings/classes",
    Component: SettingsClasses,
  },
  {
    path: "/notification-settings",
    Component: NotificationSettings,
  },
  {
    path: "/teacher/profile-layout-editor",
    Component: TeacherProfileLayoutEditor,
  },
  {
    path: "/teacher/student/:id/view",
    Component: TeacherStudentView,
  },
  {
    path: "/teacher/caucus-management",
    Component: TeacherCaucusManagement,
  },
  {
    path: "/caucus-chair-vote",
    Component: CaucusChairVote,
  },
  {
    path: "/teacher/bill-sorting",
    Component: TeacherBillSorting,
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
