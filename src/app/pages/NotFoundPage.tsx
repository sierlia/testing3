import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-gray-600 mb-4">The requested page does not exist.</p>
        <Link to="/" className="text-blue-600 hover:underline">Go to home</Link>
      </div>
    </div>
  );
}
