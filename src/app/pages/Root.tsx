import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../utils/AuthContext';
import { LandingPage } from './LandingPage';

export function Root() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Redirect authenticated users to their respective dashboard
      const role = user.user_metadata?.role;
      if (role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [user, loading, navigate]);

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

  // Show landing page for unauthenticated users
  return <LandingPage />;
}
