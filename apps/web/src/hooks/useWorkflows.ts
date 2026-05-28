import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const response = await apiClient.get('/workflows');
      return response.json();
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const response = await apiClient.get(`/workflows/${id}`);
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiClient.post('/workflows', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['workflowRuns', workflowId],
    queryFn: async () => {
      const response = await apiClient.get(`/workflows/${workflowId}/runs`);
      return response.json();
    },
    enabled: !!workflowId,
  });
}
