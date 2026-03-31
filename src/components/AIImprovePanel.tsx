import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Check, Copy, RefreshCw, Blend } from 'lucide-react';
import { toast } from 'sonner';
import { improveTextWithAI, AI_INTENT_LABELS, AI_INTENSITY_LABELS, AI_INTENT_DESCRIPTIONS } from '@/lib/ai';
import type { AIIntent, AIIntensity } from '@/lib/ai';

interface AIImprovePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalText: string;
  onAccept: (improvedText: string) => void;
}

export function AIImprovePanel({ open, onOpenChange, originalText, onAccept }: AIImprovePanelProps) {
  const [intent, setIntent] = useState<AIIntent>('clareza');
  const [intensity, setIntensity] = useState<AIIntensity>('media');
  const [improvedText, setImprovedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!originalText.trim()) {
      toast.error('Escreva um texto base primeiro.');
      return;
    }
    setLoading(true);
    try {
      const result = await improveTextWithAI(originalText, intent, intensity);
      setImprovedText(result);
      setHasGenerated(true);
      toast.success('Texto melhorado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao melhorar texto.');
    }
    setLoading(false);
  };

  const handleAccept = () => {
    onAccept(improvedText);
    toast.success('Versão melhorada aplicada!');
    onOpenChange(false);
    resetState();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(improvedText);
    toast.success('Texto copiado!');
  };

  const handleMerge = () => {
    onAccept(originalText + '\n\n---\n\n' + improvedText);
    toast.success('Textos mesclados!');
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setImprovedText('');
    setHasGenerated(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) resetState();
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            Melhorar com IA
          </SheetTitle>
          <SheetDescription>
            Refine seu texto com a linguagem da Inner AI
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Intent & Intensity selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Intenção</Label>
              <Select value={intent} onValueChange={(v) => setIntent(v as AIIntent)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(AI_INTENT_LABELS) as [AIIntent, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div>
                        <span className="font-medium">{v}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {AI_INTENT_DESCRIPTIONS[k]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Intensidade</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as AIIntensity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(AI_INTENSITY_LABELS) as [AIIntensity, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !originalText.trim()}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground mr-2" />
                Melhorando...
              </>
            ) : hasGenerated ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar novamente
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Melhorar texto
              </>
            )}
          </Button>

          {/* Side by side comparison */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Texto original</Label>
              <Textarea
                value={originalText}
                readOnly
                className="min-h-[140px] resize-y bg-muted/50 text-sm"
              />
            </div>

            {loading && !hasGenerated && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-accent/20 animate-ping absolute inset-0" />
                  <div className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">A IA está refinando seu texto...</p>
              </div>
            )}

            {hasGenerated && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-accent">
                  ✨ Versão melhorada
                </Label>
                <Textarea
                  value={improvedText}
                  onChange={(e) => setImprovedText(e.target.value)}
                  className="min-h-[140px] resize-y border-accent/30 bg-accent/5 text-sm"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          {hasGenerated && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button onClick={handleAccept} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Check className="h-4 w-4 mr-2" />
                Usar versão melhorada
              </Button>
              <Button onClick={handleCopy} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button onClick={handleMerge} variant="outline" className="col-span-2">
                <Blend className="h-4 w-4 mr-2" />
                Mesclar manualmente
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
