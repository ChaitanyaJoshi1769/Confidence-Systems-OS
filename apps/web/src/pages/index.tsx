import React from 'react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/auth/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Confidence Systems OS</h1>
        <p className="text-gray-400">AI-Native Operational Intelligence Platform</p>
      </div>
    </div>
  );
}
