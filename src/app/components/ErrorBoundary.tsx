export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-gray-600 mb-4">We couldn't load this page.</p>
        <a 
          href="/" 
          className="text-blue-600 hover:text-blue-700 underline"
        >
          Go back home
        </a>
      </div>
    </div>
  );
}
