import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { LeadershipBanner } from "../components/LeadershipBanner";
import { MemberRoster } from "../components/MemberRoster";
import { LeadershipElectionSection } from "../components/LeadershipElectionSection";
import { LeadershipAssignmentSection } from "../components/LeadershipAssignmentSection";
import { Users } from "lucide-react";

interface Member {
  id: string;
  name: string;
  party: string;
  isRunningForChair?: boolean;
  isRunningForRanking?: boolean;
}

interface CommitteeLeadershipPageProps {
  userRole?: 'student' | 'teacher';
}

export function CommitteeLeadership({ userRole = 'student' }: CommitteeLeadershipPageProps) {
  // Toggle between election mode and teacher-assigned mode
  const [leadershipMode] = useState<'election' | 'teacher-assigned'>('election');
  const [electionsEnabled] = useState(true);

  // Mock committee data
  const committeeName = "Education Committee";
  const committeeDescription = "Oversees K-12 and higher education policy, student loans, and educational standards.";

  // Mock members
  const [members, setMembers] = useState<Member[]>([
    { id: "m1", name: "Alice Johnson", party: "Democratic", isRunningForChair: true },
    { id: "m2", name: "Bob Smith", party: "Republican", isRunningForChair: true },
    { id: "m3", name: "Carol Martinez", party: "Democratic", isRunningForRanking: true },
    { id: "m4", name: "David Lee", party: "Republican" },
    { id: "m5", name: "Emma Davis", party: "Green" },
    { id: "m6", name: "Frank Wilson", party: "Democratic" },
  ]);

  const [chair, setChair] = useState<string | null>("m1");
  const [rankingMember, setRankingMember] = useState<string | null>("m3");

  const currentUserIsMember = true; // Mock - current user is a member of this committee

  const chairPerson = members.find(m => m.id === chair);
  const rankingPerson = members.find(m => m.id === rankingMember);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Committee header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">{committeeName}</h1>
          </div>
          <p className="text-gray-600">{committeeDescription}</p>
        </div>

        {/* Leadership banner */}
        <LeadershipBanner
          chair={chairPerson}
          rankingMember={rankingPerson}
        />

        {/* Member roster */}
        <MemberRoster
          members={members}
          chairId={chair}
          rankingMemberId={rankingMember}
        />

        {/* Leadership selection section */}
        {leadershipMode === 'election' && electionsEnabled && (
          <LeadershipElectionSection
            members={members}
            chairId={chair}
            rankingMemberId={rankingMember}
            currentUserIsMember={currentUserIsMember}
            isTeacher={userRole === 'teacher'}
            onSetChair={setChair}
            onSetRankingMember={setRankingMember}
            onUpdateMembers={setMembers}
          />
        )}

        {(leadershipMode === 'teacher-assigned' || !electionsEnabled) && userRole === 'teacher' && (
          <LeadershipAssignmentSection
            members={members}
            chairId={chair}
            rankingMemberId={rankingMember}
            onSetChair={setChair}
            onSetRankingMember={setRankingMember}
          />
        )}
      </main>
    </div>
  );
}
