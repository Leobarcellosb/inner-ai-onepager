import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface ScheduleSectionProps {
  scheduledDate: string | null;
  scheduledTime: string | null;
  onDateChange: (date: string | null) => void;
  onTimeChange: (time: string | null) => void;
  showWarning?: boolean;
}

export function ScheduleSection({
  scheduledDate,
  scheduledTime,
  onDateChange,
  onTimeChange,
  showWarning = false,
}: ScheduleSectionProps) {
  const selectedDate = scheduledDate ? new Date(scheduledDate + 'T00:00:00') : undefined;
  const isScheduled = scheduledDate && scheduledTime;

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      isScheduled ? "border-accent/30 bg-accent/5" : showWarning ? "border-warning/50 bg-warning/5" : "border-border"
    )}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-display font-semibold flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-accent" />
          Agendamento
        </Label>
        {isScheduled ? (
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
            Agendado
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
            Sem agendamento
          </Badge>
        )}
      </div>

      {showWarning && !isScheduled && (
        <div className="flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Defina data e horário antes de concluir este conteúdo.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm",
                  !scheduledDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => onDateChange(date ? format(date, 'yyyy-MM-dd') : null)}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Horário</Label>
          <div className="relative">
            <Clock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="time"
              value={scheduledTime || ''}
              onChange={(e) => onTimeChange(e.target.value || null)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {isScheduled && (
        <div className="text-xs text-muted-foreground">
          Publicação: {format(selectedDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {scheduledTime!.slice(0, 5)}
        </div>
      )}

      {isScheduled && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-destructive h-7"
          onClick={() => { onDateChange(null); onTimeChange(null); }}
        >
          Remover agendamento
        </Button>
      )}
    </div>
  );
}
