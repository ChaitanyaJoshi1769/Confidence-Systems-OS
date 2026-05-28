import React from 'react';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: workflowsData, isLoading } = useWorkflows();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Confidence Systems OS</h1>
          <div className="text-gray-400">Welcome, {user?.firstName || user?.email}</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded p-6 border border-gray-800">
            <div className="text-gray-400 text-sm">Workflows</div>
            <div className="text-3xl font-bold">{workflowsData?.workflows?.length || 0}</div>
          </div>
          <div className="bg-gray-900 rounded p-6 border border-gray-800">
            <div className="text-gray-400 text-sm">Active Runs</div>
            <div className="text-3xl font-bold">0</div>
          </div>
          <div className="bg-gray-900 rounded p-6 border border-gray-800">
            <div className="text-gray-400 text-sm">Completed Today</div>
            <div className="text-3xl font-bold">0</div>
          </div>
          <div className="bg-gray-900 rounded p-6 border border-gray-800">
            <div className="text-gray-400 text-sm">Compliance Score</div>
            <div className="text-3xl font-bold">98%</div>
          </div>
        </div>

        <div className="bg-gray-900 rounded border border-gray-800 p-6">
          <h2 className="text-xl font-bold mb-4">Recent Workflows</h2>
          {isLoading ? (
            <p className="text-gray-400">Loading workflows...</p>
          ) : (
            <div className="text-gray-400">
              {workflowsData?.workflows?.length === 0 ? (
                <p>No workflows created yet</p>
              ) : (
                <ul className="space-y-2">
                  {workflowsData?.workflows?.map((w: any) => (
                    <li key={w.id} className="flex justify-between items-center py-2 border-b border-gray-800">
                      <span>{w.name}</span>
                      <span className="text-xs px-2 py-1 bg-blue-900 rounded">{w.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
