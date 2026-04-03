import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Content } from '@/types';

/**
 * Single source of truth for all contents.
 * Every operational view reads from this hook.
 * Sorting/filtering happens in the component via useMemo.
 */
export function useContents() {
  return useQuery<Content[]>({
    queryKey: ['contents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Content[];
    },
  });
}
