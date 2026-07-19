<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { CalendarCheck, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import type { FiscalCalendar, FiscalCalendarEntry, FiscalCalendarEntryPayload, FiscalCalendarPayload } from '@stelfaro/api-client';
import { UiButton, UiDataTable, UiInput, UiModalShell, UiPanel, UiRefreshButton, UiSelect, UiStatusBadge, UiTextarea, UiToggle } from '@stelfaro/ui';
import { useCoreSessionStore } from '../stores/coreSession';

const core = useCoreSessionStore();
const calendars = ref<FiscalCalendar[]>([]);
const selectedCalendarId = ref<number | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const calendarModalOpen = ref(false);
const entryModalOpen = ref(false);
const editingCalendarId = ref<number | null>(null);
const editingEntry = ref<FiscalCalendarEntry | null>(null);

type CalendarForm = Omit<FiscalCalendarPayload, 'source_name' | 'source_reference' | 'notes'> & { source_name: string; source_reference: string; notes: string };
type EntryForm = Omit<FiscalCalendarEntryPayload, 'form_code' | 'applicability' | 'notes'> & { form_code: string; applicability: string; notes: string };

const calendarForm = reactive<CalendarForm>({
  year: new Date().getFullYear(),
  name: '',
  status: 'draft',
  source_name: 'Ministerio de Hacienda de El Salvador',
  source_reference: '',
  notes: ''
});

const entryForm = reactive<EntryForm>({
  date: '',
  type: 'holiday',
  name: '',
  is_non_business_day: true,
  form_code: '',
  applicability: '',
  notes: '',
  active: true
});

const selectedCalendar = computed(() => calendars.value.find(calendar => calendar.id === selectedCalendarId.value) ?? calendars.value[0] ?? null);
const yearOptions = computed(() => calendars.value.map(calendar => ({ value: calendar.id, label: `${calendar.year} · ${statusLabel(calendar.status)}` })));
const nonBusinessCount = computed(() => selectedCalendar.value?.entries.filter(entry => entry.active && entry.is_non_business_day).length ?? 0);
const deadlineCount = computed(() => selectedCalendar.value?.entries.filter(entry => entry.active && entry.type === 'declaration_deadline').length ?? 0);

const statusOptions = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived', label: 'Archivado' }
];

const typeOptions = [
  { value: 'holiday', label: 'Asueto fiscal' },
  { value: 'declaration_deadline', label: 'Vencimiento de declaración' },
  { value: 'other', label: 'Otra fecha fiscal' }
];

onMounted(() => void load());

async function load(preferredId?: number): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const response = await core.client.fiscalCalendars();
    calendars.value = response.data;
    selectedCalendarId.value = preferredId && response.data.some(item => item.id === preferredId)
      ? preferredId
      : selectedCalendarId.value && response.data.some(item => item.id === selectedCalendarId.value)
        ? selectedCalendarId.value
        : response.data[0]?.id ?? null;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible cargar el calendario fiscal.';
  } finally {
    loading.value = false;
  }
}

function openNewCalendar(): void {
  const year = Math.max(new Date().getFullYear(), ...calendars.value.map(calendar => calendar.year)) + (calendars.value.length ? 1 : 0);
  Object.assign(calendarForm, {
    year,
    name: `Calendario tributario ${year}`,
    status: 'draft',
    source_name: 'Ministerio de Hacienda de El Salvador',
    source_reference: '',
    notes: ''
  });
  editingCalendarId.value = null;
  calendarModalOpen.value = true;
}

function openEditCalendar(): void {
  if (!selectedCalendar.value) return;
  Object.assign(calendarForm, {
    year: selectedCalendar.value.year,
    name: selectedCalendar.value.name,
    status: selectedCalendar.value.status,
    source_name: selectedCalendar.value.source_name ?? '',
    source_reference: selectedCalendar.value.source_reference ?? '',
    notes: selectedCalendar.value.notes ?? ''
  });
  editingCalendarId.value = selectedCalendar.value.id;
  calendarModalOpen.value = true;
}

async function saveCalendar(): Promise<void> {
  saving.value = true;
  error.value = null;
  try {
    const response = editingCalendarId.value
      ? await core.client.updateFiscalCalendar(editingCalendarId.value, calendarForm)
      : await core.client.createFiscalCalendar(calendarForm);
    calendarModalOpen.value = false;
    success.value = editingCalendarId.value ? 'Calendario actualizado.' : 'Calendario creado.';
    await load(response.data.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar el calendario.';
  } finally {
    saving.value = false;
  }
}

function openNewEntry(): void {
  if (!selectedCalendar.value) return;
  editingEntry.value = null;
  Object.assign(entryForm, {
    date: `${selectedCalendar.value.year}-01-01`,
    type: 'holiday',
    name: '',
    is_non_business_day: true,
    form_code: '',
    applicability: '',
    notes: '',
    active: true
  });
  entryModalOpen.value = true;
}

function openEditEntry(entry: FiscalCalendarEntry): void {
  editingEntry.value = entry;
  Object.assign(entryForm, {
    date: entry.date,
    type: entry.type,
    name: entry.name,
    is_non_business_day: entry.is_non_business_day,
    form_code: entry.form_code ?? '',
    applicability: entry.applicability ?? '',
    notes: entry.notes ?? '',
    active: entry.active
  });
  entryModalOpen.value = true;
}

async function saveEntry(): Promise<void> {
  if (!selectedCalendar.value) return;
  saving.value = true;
  error.value = null;
  try {
    if (editingEntry.value) {
      await core.client.updateFiscalCalendarEntry(editingEntry.value.id, entryForm);
    } else {
      await core.client.createFiscalCalendarEntry(selectedCalendar.value.id, entryForm);
    }
    entryModalOpen.value = false;
    success.value = editingEntry.value ? 'Fecha actualizada.' : 'Fecha agregada.';
    await load(selectedCalendar.value.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible guardar la fecha.';
  } finally {
    saving.value = false;
  }
}

async function removeEntry(entry: FiscalCalendarEntry): Promise<void> {
  if (!window.confirm(`¿Retirar “${entry.name}” del calendario?`)) return;
  error.value = null;
  try {
    await core.client.deleteFiscalCalendarEntry(entry.id);
    success.value = 'Fecha retirada del calendario.';
    await load(selectedCalendar.value?.id);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'No fue posible retirar la fecha.';
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-SV', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function statusLabel(status: FiscalCalendar['status']): string {
  return status === 'published' ? 'Publicado' : status === 'archived' ? 'Archivado' : 'Borrador';
}

function statusTone(status: FiscalCalendar['status']): 'success' | 'neutral' | 'warning' {
  return status === 'published' ? 'success' : status === 'archived' ? 'neutral' : 'warning';
}

function typeLabel(type: FiscalCalendarEntry['type']): string {
  return type === 'holiday' ? 'Asueto' : type === 'declaration_deadline' ? 'Declaración' : 'Otra fecha';
}
</script>

<template>
  <section class="mx-auto max-w-7xl">
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Gobierno fiscal</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-950 dark:text-text">Calendario fiscal</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-muted">Administra asuetos y vencimientos sin modificar ni desplegar código.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UiRefreshButton :loading="loading" @click="load(selectedCalendar?.id)" />
        <UiButton variant="secondary" @click="openNewCalendar"><Plus class="h-4 w-4" />Nuevo año</UiButton>
        <UiButton :disabled="!selectedCalendar" @click="openNewEntry"><CalendarCheck class="h-4 w-4" />Agregar fecha</UiButton>
      </div>
    </div>

    <p v-if="error" class="mb-4 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-danger-soft dark:text-danger">{{ error }}</p>
    <p v-if="success" class="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-success-soft dark:text-success">{{ success }}</p>

    <UiPanel variant="raised" class="mb-5">
      <div class="grid gap-4 lg:grid-cols-[minmax(260px,0.7fr)_minmax(0,1.3fr)_auto] lg:items-end">
        <UiSelect v-model.number="selectedCalendarId" label="Calendario" :options="yearOptions" placeholder="Selecciona un año" />
        <div v-if="selectedCalendar" class="min-w-0 pb-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate font-bold text-slate-950 dark:text-text">{{ selectedCalendar.name }}</p>
            <UiStatusBadge :tone="statusTone(selectedCalendar.status)">{{ statusLabel(selectedCalendar.status) }}</UiStatusBadge>
          </div>
          <p class="mt-1 truncate text-sm text-slate-500 dark:text-muted">{{ selectedCalendar.source_name || 'Sin fuente registrada' }} · {{ selectedCalendar.source_reference || 'Sin referencia' }}</p>
        </div>
        <UiButton variant="secondary" :disabled="!selectedCalendar" @click="openEditCalendar"><Pencil class="h-4 w-4" />Configurar</UiButton>
      </div>
    </UiPanel>

    <div v-if="selectedCalendar" class="mb-5 grid gap-4 sm:grid-cols-3">
      <UiPanel variant="raised"><p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Fechas registradas</p><p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ selectedCalendar.entries.length }}</p></UiPanel>
      <UiPanel variant="raised"><p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Días no hábiles</p><p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ nonBusinessCount }}</p></UiPanel>
      <UiPanel variant="raised"><p class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-soft">Vencimientos</p><p class="mt-2 text-2xl font-black text-slate-950 dark:text-text">{{ deadlineCount }}</p></UiPanel>
    </div>

    <UiPanel variant="raised">
      <div v-if="!selectedCalendar && !loading" class="py-12 text-center">
        <CalendarDays class="mx-auto h-10 w-10 text-slate-400 dark:text-muted" />
        <p class="mt-3 font-bold text-slate-950 dark:text-text">Aún no hay calendarios</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-muted">Crea el primer año para comenzar.</p>
      </div>
      <UiDataTable v-else overflow="auto" min-width="min-w-[900px]">
        <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:bg-surface-muted dark:text-soft">
          <tr><th class="px-4 py-3">Fecha</th><th class="px-4 py-3">Descripción</th><th class="px-4 py-3">Tipo</th><th class="px-4 py-3">Aplicación</th><th class="px-4 py-3 text-right">Acciones</th></tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-line">
          <tr v-if="loading"><td colspan="5" class="px-4 py-6 text-slate-500 dark:text-muted">Cargando calendario...</td></tr>
          <tr v-else-if="selectedCalendar?.entries.length === 0"><td colspan="5" class="px-4 py-8 text-center text-slate-500 dark:text-muted">No hay fechas registradas para este año.</td></tr>
          <tr v-for="entry in selectedCalendar?.entries" v-else :key="entry.id" class="transition-colors hover:bg-sky-50/70 dark:hover:bg-surface-muted">
            <td class="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-700 dark:text-text">{{ formatDate(entry.date) }}</td>
            <td class="px-4 py-4"><p class="font-bold text-slate-950 dark:text-text">{{ entry.name }}</p><p v-if="entry.notes" class="mt-1 max-w-xl text-xs text-slate-500 dark:text-muted">{{ entry.notes }}</p></td>
            <td class="px-4 py-4"><UiStatusBadge :tone="entry.type === 'holiday' ? 'info' : entry.type === 'declaration_deadline' ? 'warning' : 'neutral'">{{ typeLabel(entry.type) }}</UiStatusBadge></td>
            <td class="px-4 py-4"><div class="flex flex-wrap gap-2"><UiStatusBadge :tone="entry.active ? 'success' : 'neutral'">{{ entry.active ? 'Activa' : 'Inactiva' }}</UiStatusBadge><UiStatusBadge v-if="entry.is_non_business_day" tone="warning">No hábil</UiStatusBadge><UiStatusBadge v-if="entry.form_code" tone="info">{{ entry.form_code }}</UiStatusBadge></div></td>
            <td class="px-4 py-4"><div class="flex justify-end gap-2"><UiButton size="sm" variant="secondary" icon-only aria-label="Editar" @click="openEditEntry(entry)"><Pencil class="h-4 w-4" /></UiButton><UiButton size="sm" variant="danger" icon-only aria-label="Retirar" @click="removeEntry(entry)"><Trash2 class="h-4 w-4" /></UiButton></div></td>
          </tr>
        </tbody>
      </UiDataTable>
    </UiPanel>

    <UiModalShell :open="calendarModalOpen" title="Configurar calendario" description="La versión publicada será utilizada por los cálculos fiscales." @close="calendarModalOpen = false">
      <form class="grid gap-4" @submit.prevent="saveCalendar">
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model.number="calendarForm.year" label="Año" type="number" min="2000" max="2100" /><UiSelect v-model="calendarForm.status" label="Estado" :options="statusOptions" /></div>
        <UiInput v-model="calendarForm.name" label="Nombre" />
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="calendarForm.source_name" label="Fuente oficial" /><UiInput v-model="calendarForm.source_reference" label="Documento de referencia" /></div>
        <UiTextarea v-model="calendarForm.notes" label="Notas" :rows="3" />
        <div class="flex justify-end gap-2"><UiButton variant="secondary" @click="calendarModalOpen = false">Cancelar</UiButton><UiButton type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar calendario' }}</UiButton></div>
      </form>
    </UiModalShell>

    <UiModalShell :open="entryModalOpen" :title="editingEntry ? 'Editar fecha' : 'Agregar fecha'" description="Los días no hábiles publicados afectan los cálculos fiscales." @close="entryModalOpen = false">
      <form class="grid gap-4" @submit.prevent="saveEntry">
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="entryForm.date" label="Fecha" type="date" /><UiSelect v-model="entryForm.type" label="Tipo" :options="typeOptions" /></div>
        <UiInput v-model="entryForm.name" label="Descripción" placeholder="Ej. Día de la Independencia" />
        <div v-if="entryForm.type === 'declaration_deadline'" class="grid gap-4 sm:grid-cols-2"><UiInput v-model="entryForm.form_code" label="Formulario" placeholder="Ej. F-07" /><UiInput v-model="entryForm.applicability" label="A quién aplica" placeholder="Ej. Contribuyentes de IVA" /></div>
        <UiTextarea v-model="entryForm.notes" label="Notas" :rows="3" />
        <div class="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-line dark:bg-surface-muted">
          <label class="flex items-center justify-between gap-4"><span><strong class="block text-sm text-slate-950 dark:text-text">Día no hábil</strong><small class="text-slate-500 dark:text-muted">Se excluye del conteo de días hábiles.</small></span><UiToggle v-model="entryForm.is_non_business_day" /></label>
          <label class="flex items-center justify-between gap-4"><span><strong class="block text-sm text-slate-950 dark:text-text">Fecha activa</strong><small class="text-slate-500 dark:text-muted">Puede desactivarse sin eliminar el registro.</small></span><UiToggle v-model="entryForm.active" variant="success" /></label>
        </div>
        <div class="flex justify-end gap-2"><UiButton variant="secondary" @click="entryModalOpen = false">Cancelar</UiButton><UiButton type="submit" :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar fecha' }}</UiButton></div>
      </form>
    </UiModalShell>
  </section>
</template>
