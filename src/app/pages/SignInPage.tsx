import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Gavel } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { clearOAuthReturnPath, oauthRedirectUrl, saveOAuthReturnPath } from '../utils/oauthSignup';

function LegalConsentText() {
  return (
    <p className="text-center text-xs leading-5 text-gray-500">
      By continuing, you acknowledge that you understand and agree to the{" "}
      <Link to="/terms" className="font-medium text-blue-600 hover:underline">Terms and Conditions</Link>
      {" "}and{" "}
      <Link to="/privacy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>.
    </p>
  );
}

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const safeRedirectPath = () => {
    const redirect = searchParams.get('redirect');
    return redirect && redirect.startsWith('/') && !redirect.startsWith('/signin') && !redirect.startsWith('/signup') ? redirect : null;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        // Get user role from metadata
        const { data: { user } } = await supabase.auth.getUser();
        const role = user?.user_metadata?.role;

        toast.success('Successfully signed in!');
        
        navigate(safeRedirectPath() ?? (role === 'teacher' ? '/classes' : '/dashboard'));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectPath = safeRedirectPath() ?? '/dashboard';
      saveOAuthReturnPath(redirectPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: oauthRedirectUrl() },
      });
      if (error) throw error;
    } catch (error: any) {
      clearOAuthReturnPath();
      toast.error(error.message || 'Failed to start Google sign in');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gavel className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Gavel</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-medium uppercase text-gray-500">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <GoogleAuthButton onClick={() => void handleGoogleSignIn()} loading={googleLoading}>
              Log in with Google
            </GoogleAuthButton>

            <div className="mt-6 text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/signup" className="text-blue-600 hover:underline font-medium">
                Sign up
              </Link>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link to="/" className="block text-center text-sm text-gray-600 hover:underline">
                Back to home
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4">
          <LegalConsentText />
        </div>
      </div>
    </div>
  );
}
