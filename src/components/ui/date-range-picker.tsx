
import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import { DateRange } from "react-day-picker"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps {
    className?: string
    date?: DateRange
    onDateChange?: (date: DateRange | undefined) => void
}

function endOfYesterday(): Date {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    d.setDate(d.getDate() - 1);
    return d;
}

export function DatePickerWithRange({
    className,
    date,
    onDateChange,
}: DatePickerWithRangeProps) {
    const [open, setOpen] = React.useState(false)
    const [draft, setDraft] = React.useState<DateRange | undefined>(date)
    const [calendarMonth, setCalendarMonth] = React.useState<Date | undefined>(
        () => date?.from ?? new Date(),
    )

    React.useEffect(() => {
        setDraft(date)
        if (date?.from) {
            setCalendarMonth(date.from)
        }
    }, [date])

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setCalendarMonth(draft?.from ?? date?.from ?? new Date())
        } else {
            setDraft(date)
        }
        setOpen(nextOpen)
    }

    const handleApply = () => {
        const applied = draft?.from && !draft.to
            ? { from: draft.from, to: draft.from }
            : draft
        onDateChange?.(applied)
        setOpen(false)
    }

    const hasSelection = !!draft?.from
    const maxSelectableDate = endOfYesterday()

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to && date.from.getTime() !== date.to.getTime() ? (
                                <>
                                    {format(date.from, "dd MMM yyyy", { locale: ptBR })} -{" "}
                                    {format(date.to, "dd MMM yyyy", { locale: ptBR })}
                                </>
                            ) : (
                                format(date.from, "dd MMM yyyy", { locale: ptBR })
                            )
                        ) : (
                            <span>Selecione uma data</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        selected={draft}
                        onSelect={setDraft}
                        numberOfMonths={2}
                        locale={ptBR}
                        disabled={{ after: maxSelectableDate }}
                    />
                    <div className="flex items-center justify-end gap-2 p-3 border-t border-border">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDraft(undefined); onDateChange?.(undefined); setOpen(false) }}
                            className="text-xs"
                        >
                            Limpar
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApply}
                            disabled={!hasSelection}
                            className="bg-ch-orange text-black hover:bg-ch-orange/90 text-xs gap-1"
                        >
                            <Check className="h-3 w-3" />
                            Aplicar
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
