import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReferenceAnalysis {
  analysis_summary: string;
  probable_objective: string;
  probable_audience: string;
  main_hook: string;
  copy_structure: string;
  adaptation_for_inner_ai: string;
  inspired_copy_prompt: string;
}

interface AnalyzedReference {
  id: string;
  title: string;
  platform: string;
  source_name: string;
  reference_analyses: ReferenceAnalysis[];
}

interface ReferenceSelectorProps {
  selectedReferenceId: string | null;
  onSelect: (refId: string | null, analysis: ReferenceAnalysis | null) => void;
}

export function ReferenceSelector({ selectedReferenceId, onSelect }: ReferenceSelectorProps) {
  const [refs, setRefs] = useState<AnalyzedReference[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ReferenceAnalysis | null>(null);

  useEffect(() => {
    supabase
      .from('references')
      .select('id, title, platform, source_name, reference_analyses(analysis_summary, probable_objective, probable_audience, main_hook, copy_structure, adaptation_for_inner_ai, inspired_copy_prompt)')
      .eq('analysis_status', 'analisado')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRefs(data as unknown as AnalyzedReference[]);
      });
  }, []);

  const handleSelect = (refId: string) => {
    if (refId === 'none') {
      setSelectedAnalysis(null);
      onSelect(null, null);
      return;
    }
    const ref = refs.find(r => r.id === refId);
    const analysis = ref?.reference_analyses?.[0] || null;
    setSelectedAnalysis(analysis);
    onSelect(refId, analysis);
  };

  const handleClear = () => {
    setSelectedAnalysis(null);
    onSelect(null, null);
  };

  if (refs.length === 0) return null;

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            Base Estratégica (Referência Analisada)
          </CardTitle>
          {selectedReferenceId && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClear}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={selectedReferenceId || 'none'} onValueChange={handleSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Selecionar referência analisada..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            {refs.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.title} {r.source_name && `(${r.source_name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedAnalysis && (
          <div className="space-y-2 rounded-md bg-background p-3 text-xs">
            <div>
              <span className="font-medium text-muted-foreground">Objetivo:</span>{' '}
              <span>{selectedAnalysis.probable_objective}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Público:</span>{' '}
              <span>{selectedAnalysis.probable_audience}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Hook:</span>{' '}
              <span>{selectedAnalysis.main_hook}</span>
            </div>
            {selectedAnalysis.adaptation_for_inner_ai && (
              <div>
                <span className="font-medium text-muted-foreground">Adaptação Inner AI:</span>{' '}
                <span>{selectedAnalysis.adaptation_for_inner_ai}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
