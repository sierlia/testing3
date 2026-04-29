import { Crown, Award } from "lucide-react";

interface Member {
  id: string;
  name: string;
  party: string;
}

interface LeadershipBannerProps {
  chair?: Member;
  rankingMember?: Member;
}

export function LeadershipBanner({ chair, rankingMember }: LeadershipBannerProps) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 mb-6 text-white">
      <h2 className="text-lg font-semibold mb-4">Committee Leadership</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chair */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-5 h-5 text-yellow-300" />
            <h3 className="font-semibold">Chair</h3>
          </div>
          {chair ? (
            <div>
              <p className="text-xl font-bold">{chair.name}</p>
              <p className="text-sm text-blue-100">{chair.party}</p>
            </div>
          ) : (
            <p className="text-blue-200 italic">To be determined</p>
          )}
        </div>

        {/* Ranking Member */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-blue-200" />
            <h3 className="font-semibold">Ranking Member</h3>
          </div>
          {rankingMember ? (
            <div>
              <p className="text-xl font-bold">{rankingMember.name}</p>
              <p className="text-sm text-blue-100">{rankingMember.party}</p>
            </div>
          ) : (
            <p className="text-blue-200 italic">To be determined</p>
          )}
        </div>
      </div>
    </div>
  );
}
