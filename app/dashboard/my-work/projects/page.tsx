'use client';

import { useEffect, useState } from 'react';
import ProjectsContent from './ProjectsContent';

export default function ProjectsPage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render anything on server or during initial hydration
  if (!isClient) {
    return null;
  }

  return <ProjectsContent />;
}
