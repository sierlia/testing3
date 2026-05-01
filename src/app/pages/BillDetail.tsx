import { useEffect, useMemo, useState } from "react";
import { Navigation } from "../components/Navigation";
import { BillStatusTimeline } from "../components/BillStatusTimeline";
import { BillSponsors } from "../components/BillSponsors";
import { BillActions } from "../components/BillActions";
import { FileText, BookOpen, AlertCircle } from "lucide-react";
import { useParams } from "react-router";
import { fetchBillDetail, toggleCosponsor } from "../services/bills";
import { supabase } from "../utils/supabase";
import { toast } from "sonner";

export function BillDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'legislative' | 'supporting'>('legislative');

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<any>(null);
  const [sponsor, setSponsor] = useState<any>(null);
  const [cosponsors, setCosponsors] = useState<any[]>([]);
  const [cosponsorIds, setCosponsorIds] = useState<string[]>([]);
  const [referral, setReferral] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'teacher' | 'leadership'>('student');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const me = auth.user?.id ?? null;
        setCurrentUserId(me);

        if (!id) return;
        const res = await fetchBillDetail(id);
        setBill(res.bill);
        setSponsor(res.sponsor);
        setCosponsors(res.cosponsors);
        setCosponsorIds(res.cosponsorIds);
        setReferral(res.referral);

        if (me) {
          const { data: p } = await supabase.from('profiles').select('role').eq('user_id', me).maybeSingle();
          if ((p as any)?.role === 'teacher') setUserRole('teacher');
        }
      } catch (e: any) {
        toast.error(e.message || 'Could not load bill');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const isUserCosponsor = useMemo(() => (currentUserId ? cosponsorIds.includes(currentUserId) : false), [cosponsorIds, currentUserId]);

  const timeline = useMemo(() => {
    if (!bill) return [];
    const createdAt = bill.created_at;
    if (bill.status === 'draft') {
      return [
        { stage: 'Introduced', status: 'upcoming' as const, date: null },
        { stage: 'Committee', status: 'upcoming' as const, date: null },
      ];
    }
    if (referral) {
      return [
        { stage: 'Introduced', status: 'completed' as const, date: createdAt },
        {
          stage: referral.committee_name ?? 'Committee',
          status: 'current' as const,
          date: referral.referred_at ?? createdAt,
          tone: 'orange' as const,
          currentLabel: 'Referred to committee',
        },
      ];
    }
    return [
      { stage: 'Introduced', status: 'current' as const, date: createdAt },
      { stage: 'Committee', status: 'upcoming' as const, date: null },
    ];
  }, [bill, referral]);

  if (loading || !bill) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-5xl mx-auto px-4 py-8 text-gray-600">Loading...</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-lg font-bold text-gray-900">{bill.hr_label}</span>
                <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                  {bill.status}
                </span>
                {bill.status === "draft" && (
                  <div className="flex items-center gap-1.5 text-sm px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
                    <AlertCircle className="w-4 h-4" />
                    Hold
                  </div>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{bill.title}</h1>
              <p className="text-sm text-gray-600">H.R. Bill</p>
            </div>
          </div>

          {bill.status === "draft" && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
              <strong>Hold Status:</strong> The sponsor has placed a hold on this bill, signaling to leadership 
              that it should not move forward at this time.
            </div>
          )}
        </div>

        {/* Status Timeline */}
          <BillStatusTimeline timeline={timeline} />

        {/* Sponsor and Cosponsors */}
          <BillSponsors
            sponsor={{
              id: sponsor?.user_id ?? bill.author_user_id,
              name: sponsor?.display_name ?? 'Unknown',
              party: sponsor?.party ?? 'Independent',
              constituency: sponsor?.constituency_name ?? undefined,
            }}
            cosponsors={(cosponsors ?? []).map((c) => ({ id: c.user_id, name: c.display_name ?? 'Unknown', party: c.party ?? 'Independent' }))}
            isUserCosponsor={isUserCosponsor}
            currentUserId={currentUserId ?? ''}
            onToggleCosponsor={(next) => {
              if (!id) return;
              const run = async () => {
                try {
                  await toggleCosponsor(id, next);
                  setCosponsorIds((prev) => {
                    if (!currentUserId) return prev;
                    return next ? [...new Set([...prev, currentUserId])] : prev.filter((x) => x !== currentUserId);
                  });
                  toast.success(next ? 'Cosponsored' : 'Removed cosponsorship');
                } catch (e: any) {
                  toast.error(e.message || 'Could not update cosponsorship');
                }
              };
              void run();
            }}
          />

        {/* Tabs for Legislative Text and Supporting Text */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('legislative')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                  activeTab === 'legislative'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Legislative Text
              </button>
                <button
                  onClick={() => setActiveTab('supporting')}
                  className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                    activeTab === 'supporting'
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Supporting Text
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'legislative' && (
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: bill.legislative_text }}
                />
              )}
              {activeTab === 'supporting' && (
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: bill.supporting_text || "<p><em>No supporting text</em></p>" }}
                />
              )}
            </div>
          </div>

        {/* Role-based actions */}
          <BillActions
            bill={{
              id: bill.id,
              number: bill.hr_label,
              committee: "",
              currentStatus: bill.status,
              hasHold: bill.status === "draft",
            }}
            userRole={userRole}
            currentUserId={currentUserId ?? ""}
          />
      </main>
    </div>
  );
}
