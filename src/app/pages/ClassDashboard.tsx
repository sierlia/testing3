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
  studentName: string;
  action: string;
  timestamp: Date;
  type: 'bill' | 'vote' | 'caucus' | 'committee';
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

  // Mock class data based on ID
  const className = classId === '1' ? 'super amazing class' : 'testing class 123';
  const studentCount = classId === '1' ? 24 : 18;

  // Mock student activity data
  const [recentActivity] = useState<StudentActivity[]>([
    {
      id: '1',
      studentName: 'Less Tin',
      action: 'Submitted H.R. 234 - Education Funding Act',
      timestamp: new Date('2026-03-16T09:30:00'),
      type: 'bill',
    },
    {
      id: '2',
      studentName: 'Sarah Johnson',
      action: 'Voted on H.R. 123',
      timestamp: new Date('2026-03-16T08:15:00'),
      type: 'vote',
    },
    {
      id: '3',
      studentName: 'Michael Chen',
      action: 'Posted in Democratic Caucus',
      timestamp: new Date('2026-03-16T07:45:00'),
      type: 'caucus',
    },
    {
      id: '4',
      studentName: 'Emma Williams',
      action: 'Submitted amendment to H.R. 234',
      timestamp: new Date('2026-03-15T16:20:00'),
      type: 'committee',
    },
    {
      id: '5',
      studentName: 'David Martinez',
      action: 'Joined Education Committee',
      timestamp: new Date('2026-03-15T14:30:00'),
      type: 'committee',
    },
  ]);

  // Mock upcoming deadlines/events
  const [upcomingEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'Bill Submissions Due',
      date: new Date('2026-03-20T23:59:00'),
      type: 'deadline',
    },
    {
      id: '2',
      title: 'Committee Markup Session',
      date: new Date('2026-03-22T14:00:00'),
      type: 'session',
    },
    {
      id: '3',
      title: 'Floor Session - Voting',
      date: new Date('2026-03-25T10:00:00'),
      type: 'session',
    },
    {
      id: '4',
      title: 'Speaker Election',
      date: new Date('2026-03-27T13:00:00'),
      type: 'election',
    },
  ]);

  // Statistics
  const stats = {
    activeBills: 12,
    completedVotes: 8,
    activeCommittees: 5,
    upcomingDeadlines: upcomingEvents.filter(e => e.type === 'deadline').length,
  };

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
      case 'vote':
        return <Vote className="w-4 h-4 text-green-600" />;
      case 'caucus':
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'committee':
        return <BookOpen className="w-4 h-4 text-orange-600" />;
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
            <Button onClick={() => navigate(`/teacher/class/${classId}/manage`)}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Class
            </Button>
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
                          <span className="font-semibold">{activity.studentName}</span> {activity.action}
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
