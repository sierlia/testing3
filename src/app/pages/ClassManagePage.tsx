import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Gavel, ArrowLeft, Users, Copy, Check, Settings, UserX } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';

interface Student {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  status: string;
}

interface ClassDetails {
  id: string;
  name: string;
  description: string;
  joinCode: string;
  createdAt: string;
  sessionLength: number;
}

export function ClassManagePage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    loadClassData();
  }, [classId]);

  const loadClassData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/signin');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a645ae66/classes/${classId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setClassDetails(data.class);
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Error loading class data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const copyJoinCode = () => {
    if (classDetails) {
      navigator.clipboard.writeText(classDetails.joinCode);
      setCopiedCode(true);
      toast.success('Join code copied to clipboard!');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to remove this student from the class?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-a645ae66/classes/${classId}/students/${studentId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Student removed successfully');
        loadClassData();
      } else {
        throw new Error('Failed to remove student');
      }
    } catch (error) {
      toast.error('Failed to remove student');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="py-16 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Class Not Found</h3>
            <p className="text-gray-600 mb-4">This class does not exist or you don't have access to it.</p>
            <Button onClick={() => navigate('/teacher/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/teacher/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Gavel className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{classDetails.name}</h1>
              <p className="text-sm text-gray-600">Class Management</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Join Code</CardTitle>
              <CardDescription>Share this code with students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 font-mono">
                  {classDetails.joinCode}
                </div>
                <Button size="sm" variant="ghost" onClick={copyJoinCode}>
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Students</CardTitle>
              <CardDescription>Enrolled in this class</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900">{students.length}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Length</CardTitle>
              <CardDescription>Typical class duration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900">
                {classDetails.sessionLength}
                <span className="text-xl text-gray-500 ml-2">min</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                <CardTitle>Student Roster</CardTitle>
                <CardDescription>
                  Manage students enrolled in this class
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Students Yet</h3>
                    <p className="text-gray-600 mb-4">
                      Share the join code with students to get started
                    </p>
                    <Button onClick={copyJoinCode}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Join Code
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>
                            {new Date(student.joinedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                              {student.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStudent(student.id)}
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Class Settings</CardTitle>
                <CardDescription>
                  Configure your class preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-gray-900 mb-2">Class Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Class ID:</span>
                        <span className="font-mono text-gray-900">{classDetails.id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="text-gray-900">
                          {new Date(classDetails.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {classDetails.description && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                      <p className="text-sm text-gray-700">{classDetails.description}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <Button variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Class Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}