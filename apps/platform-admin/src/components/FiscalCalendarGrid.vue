<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { FiscalCalendarEntry } from '@stelfaro/api-client';

const props = defineProps<{
  year: number;
  month: number;
  entries: FiscalCalendarEntry[];
}>();

const emit = defineEmits<{
  'update:month': [month: number];
  select: [date: string];
}>();

type CalendarCell = {
  key: string;
  date: string | null;
  day: number | null;
  weekend: boolean;
  today: boolean;
  entries: FiscalCalendarEntry[];
};

const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const monthLabel = computed(() => new Intl.DateTimeFormat('es-SV', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(props.year, props.month, 1))));

const cells = computed<CalendarCell[]>(() => {
  const firstWeekDay = new Date(Date.UTC(props.year, props.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(props.year, props.month + 1, 0)).getUTCDate();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const result: CalendarCell[] = [];

  for (let index = 0; index < firstWeekDay; index += 1) {
    result.push({ key: `before-${index}`, date: null, day: null, weekend: false, today: false, entries: [] });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${props.year}-${pad(props.month + 1)}-${pad(day)}`;
    const weekDay = new Date(Date.UTC(props.year, props.month, day)).getUTCDay();
    result.push({
      key: date,
      date,
      day,
      weekend: weekDay === 0 || weekDay === 6,
      today: date === todayKey,
      entries: props.entries.filter(entry => entry.date === date)
    });
  }

  while (result.length % 7 !== 0 || result.length < 35) {
    result.push({ key: `after-${result.length}`, date: null, day: null, weekend: false, today: false, entries: [] });
  }

  return result;
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function previousMonth(): void {
  if (props.month > 0) emit('update:month', props.month - 1);
}

function nextMonth(): void {
  if (props.month < 11) emit('update:month', props.month + 1);
}

function entryClass(entry: FiscalCalendarEntry): string {
  if (!entry.active) return 'bg-surface-strong text-muted';
  if (entry.type === 'holiday') return 'bg-primary-soft text-primary';
  if (entry.type === 'declaration_deadline') return 'bg-warning-soft text-warning';
  return 'bg-success-soft text-success';
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-surface-raised">
    <header class="flex items-center justify-between gap-4 border-b border-line px-4 py-4">
      <button type="button" class="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-30" aria-label="Mes anterior" :disabled="month === 0" @click="previousMonth">
        <ChevronLeft class="h-5 w-5" />
      </button>
      <div class="text-center">
        <p class="text-xl font-black capitalize text-text">{{ monthLabel }}</p>
        <p class="mt-1 text-xs text-muted">Selecciona un día para administrar sus actividades</p>
      </div>
      <button type="button" class="grid h-10 w-10 place-items-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-30" aria-label="Mes siguiente" :disabled="month === 11" @click="nextMonth">
        <ChevronRight class="h-5 w-5" />
      </button>
    </header>

    <div class="grid grid-cols-7 border-b border-line bg-surface-muted">
      <div v-for="(weekDay, index) in weekDays" :key="weekDay" class="px-2 py-3 text-center text-xs font-black uppercase tracking-wide" :class="index === 0 || index === 6 ? 'text-soft' : 'text-muted'">{{ weekDay }}</div>
    </div>

    <div class="grid grid-cols-7 bg-line" style="gap: 1px">
      <div v-for="cell in cells" :key="cell.key" class="min-h-24 bg-surface-raised sm:min-h-32">
        <button
          v-if="cell.date"
          type="button"
          class="group flex h-full min-h-24 w-full flex-col p-2 text-left transition hover:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary sm:min-h-32 sm:p-3"
          :class="cell.weekend ? 'bg-surface-muted/60' : ''"
          @click="emit('select', cell.date)"
        >
          <span class="flex w-full items-center justify-between gap-2">
            <span class="grid h-7 min-w-7 place-items-center rounded-full px-1 text-sm font-bold" :class="cell.today ? 'bg-primary text-primary-contrast' : cell.weekend ? 'text-soft' : 'text-text'">{{ cell.day }}</span>
            <span v-if="cell.weekend" class="hidden text-[10px] font-bold uppercase tracking-wide text-soft lg:inline">No hábil</span>
          </span>
          <span class="mt-2 grid w-full gap-1">
            <span v-for="entry in cell.entries.slice(0, 2)" :key="entry.id" class="truncate rounded-md px-2 py-1 text-[11px] font-bold" :class="entryClass(entry)">{{ entry.name }}</span>
            <span v-if="cell.entries.length > 2" class="px-1 text-[11px] font-bold text-muted">+{{ cell.entries.length - 2 }} más</span>
          </span>
        </button>
      </div>
    </div>

    <footer class="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-4 py-3 text-xs font-semibold text-muted">
      <span class="flex items-center gap-2"><i class="h-2.5 w-2.5 rounded-full bg-primary"></i>Asueto</span>
      <span class="flex items-center gap-2"><i class="h-2.5 w-2.5 rounded-full bg-warning"></i>Declaración</span>
      <span class="flex items-center gap-2"><i class="h-2.5 w-2.5 rounded-full bg-success"></i>Otra actividad</span>
      <span class="flex items-center gap-2"><i class="h-2.5 w-2.5 rounded-full bg-surface-strong"></i>Fin de semana</span>
    </footer>
  </div>
</template>
