import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Gavel, GraduationCap, BookOpen, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../utils/supabase';

export function SignUpPage() {
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'student' | null>(null);

  if (selectedRole === 'teacher') {
    return <TeacherSignUp onBack={() => setSelectedRole(null)} />;
  }

  if (selectedRole === 'student') {
    return <StudentSignUp onBack={() => setSelectedRole(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gavel className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Gavel</h1>
          </div>
          <p className="text-gray-600">Choose your account type to get started</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
            onClick={() => setSelectedRole('teacher')}
          >
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-8 h-8 text-blue-600" />
              </div>
              <CardTitle className="text-center text-2xl">Teacher Account</CardTitle>
              <CardDescription className="text-center">
                Create and manage legislative simulations for your classroom
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>• Create unlimited classes</li>
                <li>• Generate join codes for students</li>
                <li>• Manage committees and assignments</li>
                <li>• Track student progress</li>
                <li>• Full admin controls</li>
              </ul>
              <Button className="w-full" size="lg">
                Sign Up as Teacher
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-500"
            onClick={() => setSelectedRole('student')}
          >
            <CardHeader>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-center text-2xl">Student Account</CardTitle>
              <CardDescription className="text-center">
                Join your class simulation and participate in the legislative process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 mb-6">
                <li>• Join with a class code</li>
                <li>• Choose your constituency and party</li>
                <li>• Draft and sponsor bills</li>
                <li>• Participate in committees</li>
                <li>• Vote on legislation</li>
              </ul>
              <Button className="w-full" size="lg" variant="outline">
                Sign Up as Student
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link to="/signin" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-600 hover:underline">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function TeacherSignUp({ onBack }: { onBack: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    school: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: 'teacher',
            school: formData.school,
          },
        },
      });

      if (error) throw error;

      toast.success('Account created successfully!');
      
      // Redirect to teacher dashboard
      window.location.href = '/teacher/dashboard';
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Create Teacher Account</CardTitle>
            <CardDescription>
              Set up your account to start creating simulations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Dr. Jane Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@school.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="school">School/Institution</Label>
                <Input
                  id="school"
                  placeholder="Lincoln High School"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Teacher Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentSignUp({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    joinCode: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Create user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: 'student',
            joinCode: formData.joinCode,
          },
        },
      });

      if (error) throw error;

      toast.success('Account created successfully!');
      
      // Redirect to onboarding
      navigate('/onboarding');
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Create Student Account</CardTitle>
            <CardDescription>
              Join your class with a code from your teacher
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinCode">Class Join Code</Label>
                <Input
                  id="joinCode"
                  placeholder="ABC123"
                  value={formData.joinCode}
                  onChange={(e) => setFormData({ ...formData, joinCode: e.target.value.toUpperCase() })}
                  required
                  maxLength={6}
                  className="uppercase"
                />
                <p className="text-xs text-gray-500">
                  Enter the 6-character code provided by your teacher
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Student Account'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium shadow-sm"
              >
                <KeyRound className="w-4 h-4" />
                Bypass to Student Dashboard
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}