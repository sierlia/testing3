import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Gavel, 
  ArrowLeft, 
  Users, 
  Calendar as CalendarIcon, 
  BookOpen, 
  FileText, 
  Vote,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Settings,
  Bell
} from 'lucide-react';
import { supabase } from '../utils/supabase';

interface StudentActivity {
  id: string;
  studentId: string;
  studentName: string;
  action: string;
  timestamp: Date;
  type: 'bill' | 'letter' | 'caucus' | 'committee' | 'comment';
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'deadline' | 'session' | 'election';
}

export function ClassDashboard() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [className, setClassName] = useState<string>('Class');
  const [studentCount, setStudentCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<StudentActivity[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState({ activeBills: 0, completedVotes: 0, activeCommittees: 0, upcomingDeadlines: 0 });

  useEffect(() => {
    const setActive = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !classId) return;
      await supabase.from('profiles').upsert({
        user_id: user.id,
        class_id: classId,
        role: 'teacher',
        display_name: user.user_metadata?.name ?? null,
      });
    };
    void setActive();
  }, [classId]);

  useEffect(() => {
    const load = async () => {
      if (!classId) return;
      try {
        const [{ data: cls, error: cErr }, { count: rosterCount }] = await Promise.all([
          supabase.from("classes").select("name").eq("id", classId).maybeSingle(),
          supabase.from("class_memberships").select("user_id", { count: "exact", head: true }).eq("class_id", classId).eq("status", "approved"),
        ]);
        if (cErr) throw cErr;
        setClassName((cls as any)?.name ?? "Class");
        setStudentCount(rosterCount ?? 0);

        const nowIso = new Date().toISOString();
        const { data: taskRows } = await supabase
          .from("class_tasks")
          .select("id,title,task_type,due_at")
          .gte("due_at", nowIso)
          .order("due_at", { ascending: true })
          .limit(6);
        const events: CalendarEvent[] = (taskRows ?? []).map((t: any) => ({
          id: t.id,
          title: `${t.task_type === "assignment" ? "Assignment" : "Deadline"}: ${t.title}`,
          date: new Date(t.due_at),
          type: "deadline",
        }));
        setUpcomingEvents(events);

        const [{ count: billsCount }, { count: committeesCount }] = await Promise.all([
          supabase.from("bills").select("id", { count: "exact", head: true }).eq("class_id", classId),
          supabase.from("committees").select("id", { count: "exact", head: true }).eq("class_id", classId),
        ]);
        setStats({
          activeBills: billsCount ?? 0,
          completedVotes: 0,
          activeCommittees: committeesCount ?? 0,
          upcomingDeadlines: events.length,
        });

        const [committeeRows, caucusRows] = await Promise.all([
          supabase.from("committees").select("id,name").eq("class_id", classId),
          supabase.from("caucuses").select("id,name").eq("class_id", classId),
        ]);
        const committeeMap = new Map((committeeRows.data ?? []).map((c: any) => [c.id, c.name]));
        const caucusMap = new Map((caucusRows.data ?? []).map((c: any) => [c.id, c.name]));

        const committeeIds = Array.from(committeeMap.keys());
        const caucusIds = Array.from(caucusMap.keys());

        const [bills, cm, cam, letters, cc, kcc] = await Promise.all([
          supabase.from("bills").select("id,title,bill_number,author_user_id,created_at,status").eq("class_id", classId).order("created_at", { ascending: false }).limit(10),
          committeeIds.length
            ? supabase.from("committee_members").select("committee_id,user_id,created_at").in("committee_id", committeeIds).order("created_at", { ascending: false }).limit(10)
            : Promise.resolve({ data: [] as any[] } as any),
          caucusIds.length
            ? supabase.from("caucus_members").select("caucus_id,user_id,created_at").in("caucus_id", caucusIds).order("created_at", { ascending: false }).limit(10)
            : Promise.resolve({ data: [] as any[] } as any),
          supabase.from("dear_colleague_letters").select("id,sender_user_id,subject,created_at").eq("class_id", classId).order("created_at", { ascending: false }).limit(10),
          supabase.from("caucus_comments").select("id,author_user_id,created_at,caucus_announcements(caucus_id)").order("created_at", { ascending: false }).limit(10),
          supabase.from("committee_comments").select("id,author_user_id,created_at,committee_announcements(committee_id)").order("created_at", { ascending: false }).limit(10),
        ]);

        const authorIds = new Set<string>();
        for (const r of bills.data ?? []) authorIds.add((r as any).author_user_id);
        for (const r of cm.data ?? []) authorIds.add((r as any).user_id);
        for (const r of cam.data ?? []) authorIds.add((r as any).user_id);
        for (const r of letters.data ?? []) authorIds.add((r as any).sender_user_id);
        for (const r of cc.data ?? []) authorIds.add((r as any).author_user_id);
        for (const r of kcc.data ?? []) authorIds.add((r as any).author_user_id);

        const { data: authors } = await supabase
          .from("profiles")
          .select("user_id,display_name")
          .in("user_id", authorIds.size ? Array.from(authorIds) : ["00000000-0000-0000-0000-000000000000"]);
        const authorMap = new Map((authors ?? []).map((a: any) => [a.user_id, a.display_name ?? "Unknown"]));

        const activity: StudentActivity[] = [];
        for (const r of bills.data ?? []) {
          activity.push({
            id: (r as any).id,
            studentId: (r as any).author_user_id,
            studentName: authorMap.get((r as any).author_user_id) ?? "Unknown",
            action: `${(r as any).status === "draft" ? "Drafted" : "Submitted"} H.R. ${(r as any).bill_number} â€” ${(r as any).title}`,
            timestamp: new Date((r as any).created_at),
            type: "bill",
          });
        }
        for (const r of cm.data ?? []) {
          activity.push({
            id: `${(r as any).committee_id}:${(r as any).user_id}:${(r as any).created_at}`,
            studentId: (r as any).user_id,
            studentName: authorMap.get((r as any).user_id) ?? "Unknown",
            action: `Joined ${committeeMap.get((r as any).committee_id) ?? "a committee"}`,
            timestamp: new Date((r as any).created_at),
            type: "committee",
          });
        }
        for (const r of cam.data ?? []) {
          activity.push({
            id: `${(r as any).caucus_id}:${(r as any).user_id}:${(r as any).created_at}`,
            studentId: (r as any).user_id,
            studentName: authorMap.get((r as any).user_id) ?? "Unknown",
            action: `Joined ${caucusMap.get((r as any).caucus_id) ?? "a caucus"}`,
            timestamp: new Date((r as any).created_at),
            type: "caucus",
          });
        }
        for (const r of letters.data ?? []) {
          activity.push({
            id: (r as any).id,
            studentId: (r as any).sender_user_id,
            studentName: authorMap.get((r as any).sender_user_id) ?? "Unknown",
            action: `Sent a Dear Colleague letter${(r as any).subject ? `: ${(r as any).subject}` : ""}`,
            timestamp: new Date((r as any).created_at),
            type: "letter",
          });
        }
        for (const r of cc.data ?? []) {
          const caucusId = (r as any)?.caucus_announcements?.caucus_id;
          activity.push({
            id: (r as any).id,
            studentId: (r as any).author_user_id,
            studentName: authorMap.get((r as any).author_user_id) ?? "Unknown",
            action: `Commented in ${caucusId ? caucusMap.get(caucusId) ?? "a caucus" : "a caucus"}`,
            timestamp: new Date((r as any).created_at),
            type: "comment",
          });
        }
        for (const r of kcc.data ?? []) {
          const committeeId = (r as any)?.committee_announcements?.committee_id;
          activity.push({
            id: (r as any).id,
            studentId: (r as any).author_user_id,
            studentName: authorMap.get((r as any).author_user_id) ?? "Unknown",
            action: `Commented in ${committeeId ? committeeMap.get(committeeId) ?? "a committee" : "a committee"}`,
            timestamp: new Date((r as any).created_at),
            type: "comment",
          });
        }

        activity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setRecentActivity(activity.slice(0, 8));
      } catch {
        // ignore
      }
    };
    void load();
  }, [classId]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatEventDate = (date: Date) => {
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'bill':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'letter':
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case 'caucus':
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'committee':
        return <BookOpen className="w-4 h-4 text-orange-600" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-gray-700" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'deadline':
        return <Clock className="w-4 h-4 text-red-600" />;
      case 'session':
        return <CalendarIcon className="w-4 h-4 text-blue-600" />;
      case 'election':
        return <Vote className="w-4 h-4 text-purple-600" />;
      default:
        return <CalendarIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Gavel className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
                <p className="text-sm text-gray-600">{studentCount} students enrolled</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Bills</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeBills}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Votes</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completedVotes}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Committees</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.activeCommittees}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Upcoming Deadlines</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.upcomingDeadlines}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Calendar & Deadlines */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Events & Deadlines</CardTitle>
                    <CardDescription>Manage your class schedule and deadlines</CardDescription>
                  </div>
                  <Button onClick={() => navigate('/teacher/deadlines')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Deadline
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900">{event.title}</h4>
                        <p className="text-xs text-gray-600 mt-0.5">{formatEventDate(event.date)}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        event.type === 'deadline' ? 'bg-red-100 text-red-700' :
                        event.type === 'session' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/calendar')}>
                  View Full Calendar
                </Button>
              </CardContent>
            </Card>

            {/* Recent Student Activity */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Student Activity</CardTitle>
                    <CardDescription>Track what your students are doing</CardDescription>
                  </div>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity.map(activity => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <Link to={`/profile/${activity.studentId}`} className="font-semibold hover:text-blue-600 transition-colors">
                            {activity.studentName}
                          </Link>{" "}
                          {activity.action}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Manage class components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to={`/teacher/class/${classId}/manage`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    Student Roster
                  </Button>
                </Link>
                <Link to="/teacher/committee-assignments">
                  <Button variant="outline" className="w-full justify-start">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Committee Assignments
                  </Button>
                </Link>
                <Link to="/bills">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Review Bills
                  </Button>
                </Link>
                <Link to="/teacher/bill-sorting">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2" />
                    Sort Bills into Committees
                  </Button>
                </Link>
                <Link to="/elections">
                  <Button variant="outline" className="w-full justify-start">
                    <Vote className="w-4 h-4 mr-2" />
                    Manage Elections
                  </Button>
                </Link>
                <Link to="/floor-session">
                  <Button variant="outline" className="w-full justify-start">
                    <Gavel className="w-4 h-4 mr-2" />
                    Floor Session
                  </Button>
                </Link>
                <Link to="/teacher/setup">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="w-4 h-4 mr-2" />
                    Setup & Configuration
                  </Button>
                </Link>
                <Link to="/teacher/deadlines">
                  <Button variant="outline" className="w-full justify-start">
                    <Bell className="w-4 h-4 mr-2" />
                    Manage Deadlines
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
                <CardDescription>Teaching materials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/resources">
                  <Button variant="outline" className="w-full justify-start">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Curriculum Resources
                  </Button>
                </Link>
                <Link to="/teacher/admin">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
