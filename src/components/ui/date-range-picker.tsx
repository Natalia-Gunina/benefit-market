"use client"

import * as React from "react"
import { format, startOfMonth, subMonths, startOfQuarter } from "date-fns"
import { ru } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Preset {
  label: string
  range: () => DateRange
}

const today = () => new Date()

const PRESETS: Preset[] = [
  {
    label: "Этот месяц",
    range: () => ({ from: startOfMonth(today()), to: today() }),
  },
  {
    label: "Прошлый месяц",
    range: () => {
      const prev = subMonths(today(), 1)
      return { from: startOfMonth(prev), to: new Date(prev.getFullYear(), prev.getMonth() + 1, 0) }
    },
  },
  {
    label: "Квартал",
    range: () => ({ from: startOfQuarter(today()), to: today() }),
  },
  {
    label: "Всё время",
    range: () => ({ from: new Date(2020, 0, 1), to: today() }),
  },
]

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handlePreset = (preset: Preset) => {
    onChange(preset.range())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="size-4" />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, "d MMM yyyy", { locale: ru })} –{" "}
                {format(value.to, "d MMM yyyy", { locale: ru })}
              </>
            ) : (
              format(value.from, "d MMM yyyy", { locale: ru })
            )
          ) : (
            <span>Выберите период</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Период</p>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-sm font-normal"
                onClick={() => handlePreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
