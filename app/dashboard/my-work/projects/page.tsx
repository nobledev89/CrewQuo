import dynamic from 'next/dynamic';

// Disable SSR for this entire page to prevent hydration mismatches
// This forces the component to only render on the client side
const ProjectsContent = dynamic(() => import('./ProjectsContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading projects...</p>
      </div>
    </div>
  ),
});

export default function ProjectsPage() {
  return <ProjectsContent />;
}
