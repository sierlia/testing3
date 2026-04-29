import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Gavel, BookOpen, Users } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Gavel</h1>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link to="/signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Civic Education Through Legislative Simulation
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Bring democracy to life in your classroom. Gavel provides a complete platform 
            for simulating legislative processes, engaging students in real civic participation.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/signup">Start Your Simulation</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto" id="features">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Complete Legislative Experience</CardTitle>
              <CardDescription>
                From bill drafting to floor debates, students experience the full legislative process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Committee assignments & workspaces</li>
                <li>• Bill creation & amendment markup</li>
                <li>• Elections & caucuses</li>
                <li>• Live floor voting sessions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>Easy Classroom Management</CardTitle>
              <CardDescription>
                Teachers get powerful tools to set up, manage, and guide simulations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Simple class setup with join codes</li>
                <li>• Student roster management</li>
                <li>• Track simulation progress</li>
                <li>• Admin controls & oversight</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Gavel className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Authentic Civic Learning</CardTitle>
              <CardDescription>
                Students develop critical thinking and collaboration skills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Role-based participation</li>
                <li>• Party & constituency system</li>
                <li>• Collaborative bill writing</li>
                <li>• Peer communication tools</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0">
            <CardHeader>
              <CardTitle className="text-3xl text-white">Ready to Sign Up?</CardTitle>
              <CardDescription className="text-blue-100">
                Create your free account and launch your first simulation in minutes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/signup">Sign Up Now</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-20 py-8 bg-white">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© 2026 Gavel. A civic education platform for the classroom.</p>
        </div>
      </footer>
    </div>
  );
}