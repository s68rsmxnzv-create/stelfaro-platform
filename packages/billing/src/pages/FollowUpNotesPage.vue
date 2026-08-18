<script setup lang="ts">
// @ts-nocheck
import { CoreDteClient, PlatformClient } from '@stelfaro/api-client';
import { UiActionDropdown, UiActionMenuItem, UiButton, UiInput, UiLoadingMark, UiSearchInput, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import { Archive, CalendarClock, Check, Pencil, Plus, UserRound } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';
import BillingModalShell from '../components/BillingModalShell.vue';
import BillingPaginationBar from '../components/BillingPaginationBar.vue';

const props = withDefaults(defineProps<{
  platformBaseUrl?: string;
  coreBaseUrl?: string;
  authToken?: string | null;
  tenantId: number;
  company?: Record<string, any> | null;
}>(), { platformBaseUrl: '/api/v1', coreBaseUrl: '/api/v1', authToken: null, company: null });

const platform = computed(() => new PlatformClient(props.platformBaseUrl, { credentials: 'same-origin' }));
const core = computed(() => new CoreDteClient(props.coreBaseUrl, { authToken: props.authToken || undefined }));
const initialNoteId = Number(new URLSearchParams(window.location.search).get('note') || 0);
const notes = ref([]);
const stats = ref({ pending: 0, overdue: 0, today: 0 });
const meta = ref({ current_page: 1, last_page: 1, total: 0 });
const loading = ref(false);
const saving = ref(false);
const formOpen = ref(false);
const editingNote = ref(null);
const resolvingNote = ref(null);
const discardingNote = ref(null);
const customerResults = ref([]);
const customerLoading = ref(false);
const selectedCustomer = ref(null);
const toasts = ref([]);
const filters = reactive({ q: '', status: initialNoteId ? '' : 'pending', category: '', due: '', page: 1, note_id: initialNoteId || undefined });
const form = reactive({ person_name: '', person_phone: '', person_email: '', title: '', description: '', category: 'commitment', occurred_on: today(), remind_at: '' });
const resolution = reactive({ resolution_type: 'completed', resolution_note: '', resolution_reference: '' });
const discardReason = ref('');
let searchTimer;
let customerTimer;

const statusOptions = [{ value: 'pending', label: 'Pendientes' }, { value: 'resolved', label: 'Resueltas' }, { value: 'discarded', label: 'Descartadas' }, { value: '', label: 'Todas' }];
const categoryOptions = [{ value: 'commitment', label: 'Compromiso' }, { value: 'loan', label: 'Préstamo' }, { value: 'collection', label: 'Seguimiento de cobro' }, { value: 'other', label: 'Otro' }];
const categoryFilterOptions = [{ value: '', label: 'Todas las categorías' }, ...categoryOptions];
const dueOptions = [{ value: '', label: 'Cualquier fecha' }, { value: 'overdue', label: 'Atrasados' }, { value: 'today', label: 'Para hoy' }, { value: 'upcoming', label: 'Próximos' }];
const resolutionOptions = [{ value: 'completed', label: 'Compromiso cumplido' }, { value: 'returned', label: 'Devuelto' }, { value: 'invoiced', label: 'Facturado' }, { value: 'other', label: 'Otra resolución' }];
const canSave = computed(() => form.person_name.trim() && form.title.trim() && form.occurred_on);

watch(() => filters.q, () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { filters.note_id = undefined; filters.page = 1; loadNotes(); }, 250); });
watch(() => [filters.status, filters.category, filters.due], () => { filters.note_id = undefined; filters.page = 1; loadNotes(); });
watch(() => form.person_name, () => {
  clearTimeout(customerTimer);
  if (selectedCustomer.value && form.person_name !== selectedCustomer.value.name) selectedCustomer.value = null;
  if (selectedCustomer.value || form.person_name.trim().length < 2 || !props.company?.id) { customerResults.value = []; return; }
  customerTimer = setTimeout(searchCustomers, 250);
});
onMounted(loadNotes);
onBeforeUnmount(() => { clearTimeout(searchTimer); clearTimeout(customerTimer); });

async function loadNotes() {
  if (!props.tenantId) return;
  loading.value = true;
  try {
    const response = await platform.value.followUpNotes(props.tenantId, { q: filters.q || undefined, status: filters.status || undefined, category: filters.category || undefined, due: filters.due || undefined, note_id: filters.note_id, page: filters.page, per_page: 20 });
    notes.value = response.data; stats.value = response.stats; meta.value = response.meta;
  } catch (error) { notify('No se pudieron cargar los pendientes', friendlyError(error), 'error'); }
  finally { loading.value = false; }
}

function goToNotesPage(page) {
  const next = Math.min(Math.max(page, 1), meta.value.last_page);
  if (next === filters.page) return;
  filters.page = next;
  loadNotes();
}

async function searchCustomers() {
  customerLoading.value = true;
  try { customerResults.value = (await core.value.customers({ empresa_id: props.company.id, q: form.person_name.trim(), per_page: 10 })).data; }
  catch { customerResults.value = []; }
  finally { customerLoading.value = false; }
}

function chooseCustomer(customer) {
  selectedCustomer.value = customer;
  form.person_name = customer.name;
  form.person_phone = customer.phone || '';
  form.person_email = customer.email || '';
  customerResults.value = [];
}

function openCreate() {
  editingNote.value = null; selectedCustomer.value = null;
  Object.assign(form, { person_name: '', person_phone: '', person_email: '', title: '', description: '', category: 'commitment', occurred_on: today(), remind_at: '' });
  formOpen.value = true;
}

function openEdit(note) {
  editingNote.value = note;
  selectedCustomer.value = note.person.customer_id ? { id: note.person.customer_id, name: note.person.name } : null;
  Object.assign(form, { person_name: note.person.name, person_phone: note.person.phone || '', person_email: note.person.email || '', title: note.title, description: note.description || '', category: note.category, occurred_on: note.occurred_on, remind_at: toLocalInput(note.remind_at) });
  formOpen.value = true;
}

async function saveNote() {
  if (!canSave.value) return;
  saving.value = true;
  const payload = {
    core_customer_id: selectedCustomer.value?.id || null,
    person_name: form.person_name.trim(), person_phone: form.person_phone || null, person_email: form.person_email || null,
    title: form.title.trim(), description: form.description || null, category: form.category,
    occurred_on: form.occurred_on, remind_at: form.remind_at || null
  };
  try {
    if (editingNote.value) await platform.value.updateFollowUpNote(props.tenantId, editingNote.value.id, payload);
    else await platform.value.createFollowUpNote(props.tenantId, { idempotency_key: uuid(), ...payload });
    formOpen.value = false; notify(editingNote.value ? 'Pendiente actualizado' : 'Pendiente guardado', 'No afecta caja, inventario ni ventas.', 'success'); await loadNotes();
  } catch (error) { notify('No se pudo guardar', friendlyError(error), 'error'); }
  finally { saving.value = false; }
}

function openResolve(note) { resolvingNote.value = note; Object.assign(resolution, { resolution_type: 'completed', resolution_note: '', resolution_reference: '' }); }
async function resolveNote() {
  saving.value = true;
  try {
    await platform.value.resolveFollowUpNote(props.tenantId, resolvingNote.value.id, { resolution_type: resolution.resolution_type, resolution_note: resolution.resolution_note || null, resolution_reference: resolution.resolution_reference || null });
    resolvingNote.value = null; notify('Pendiente resuelto', 'La nota quedó conservada en el historial.', 'success'); await loadNotes();
  } catch (error) { notify('No se pudo resolver', friendlyError(error), 'error'); }
  finally { saving.value = false; }
}

function openDiscard(note) { discardingNote.value = note; discardReason.value = ''; }
async function discardNote() {
  if (discardReason.value.trim().length < 3) return;
  saving.value = true;
  try {
    await platform.value.discardFollowUpNote(props.tenantId, discardingNote.value.id, discardReason.value.trim());
    discardingNote.value = null; notify('Nota descartada', 'Se conservó la razón en el historial.', 'success'); await loadNotes();
  } catch (error) { notify('No se pudo descartar', friendlyError(error), 'error'); }
  finally { saving.value = false; }
}

function clearTarget() { filters.note_id = undefined; filters.status = 'pending'; history.replaceState({}, '', window.location.pathname); loadNotes(); }
function categoryLabel(value) { return categoryOptions.find((item) => item.value === value)?.label || 'Otro'; }
function categoryTone(value) { return value === 'collection' ? 'warning' : value === 'loan' ? 'info' : value === 'commitment' ? 'success' : 'neutral'; }
function statusLabel(value) { return value === 'pending' ? 'Pendiente' : value === 'resolved' ? 'Resuelta' : 'Descartada'; }
function statusTone(value) { return value === 'resolved' ? 'success' : value === 'discarded' ? 'neutral' : 'warning'; }
function reminderLabel(value) { if (!value) return 'Sin recordatorio'; const date = new Date(value); const now = new Date(); if (date < now) return `Venció ${date.toLocaleString('es-SV')}`; return `Recordar ${date.toLocaleString('es-SV')}`; }
function reminderClass(value, status) { return status === 'pending' && value && new Date(value) < new Date() ? 'text-danger' : 'text-muted'; }
function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' }); }
function toLocalInput(value) { if (!value) return ''; const date = new Date(value); const pad = (part) => String(part).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function uuid() { return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function notify(title, message = null, variant = 'info') { const id = uuid(); toasts.value.push({ id, title, message, variant }); setTimeout(() => { toasts.value = toasts.value.filter((toast) => toast.id !== id); }, 4300); }
function friendlyError(error) { const message = String(error?.message || ''); return !message || message.startsWith('validation.') ? 'Revisá los datos e intentá nuevamente.' : message; }
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <div class="rounded-md border border-line bg-surface p-6 shadow-sm shadow-surface text-text dark:shadow-none">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div><h2 class="text-2xl font-bold tracking-tight text-text">Pendientes</h2><p class="mt-1 text-sm text-muted">Recordatorios personales sin efectos en caja, inventario, ventas o facturación.</p></div>
        <UiButton @click="openCreate"><Plus class="mr-2 h-4 w-4" />Nuevo pendiente</UiButton>
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <button type="button" class="rounded-md border border-line bg-surface-muted px-4 py-3 text-left transition hover:border-primary/50" @click="filters.status = 'pending'; filters.due = ''"><p class="text-xs font-semibold uppercase text-soft">Pendientes</p><p class="mt-1 text-2xl font-bold">{{ stats.pending }}</p></button>
        <button type="button" class="rounded-md border border-line bg-surface-muted px-4 py-3 text-left transition hover:border-danger/50" @click="filters.due = 'overdue'"><p class="text-xs font-semibold uppercase text-soft">Atrasados</p><p class="mt-1 text-2xl font-bold text-danger">{{ stats.overdue }}</p></button>
        <button type="button" class="rounded-md border border-line bg-surface-muted px-4 py-3 text-left transition hover:border-primary/50" @click="filters.due = 'today'"><p class="text-xs font-semibold uppercase text-soft">Para hoy</p><p class="mt-1 text-2xl font-bold">{{ stats.today }}</p></button>
      </div>
    </div>

    <div class="rounded-md border border-line bg-surface p-5">
      <div v-if="filters.note_id" class="mb-4 flex items-center justify-between rounded-md bg-primary-soft px-4 py-3 text-sm text-primary"><span>Mostrando el pendiente de la notificación.</span><UiButton size="sm" variant="ghost" @click="clearTarget">Ver todos</UiButton></div>
      <div class="grid gap-3 lg:grid-cols-[1fr_190px_190px_190px]">
        <UiSearchInput v-model="filters.q" label="Buscar" placeholder="Persona, asunto o detalle" />
        <UiSelect v-model="filters.status" label="Estado" :options="statusOptions" />
        <UiSelect v-model="filters.category" label="Categoría" :options="categoryFilterOptions" />
        <UiSelect v-model="filters.due" label="Recordatorio" :options="dueOptions" />
      </div>
    </div>

    <div class="overflow-hidden rounded-md border border-line bg-surface">
      <div v-if="meta.last_page > 1" class="border-b border-line px-5 py-4">
        <BillingPaginationBar :meta="meta" :loading="loading" @page="goToNotesPage" />
      </div>

      <UiLoadingMark v-if="loading" class="p-10" label="Cargando pendientes" />
      <p v-else-if="notes.length === 0" class="p-10 text-center text-sm text-muted">No hay pendientes con estos filtros.</p>
      <div v-else class="divide-y divide-line">
        <article v-for="note in notes" :key="note.id" class="grid gap-4 p-5 transition hover:bg-primary-soft/60 dark:hover:bg-surface-muted lg:grid-cols-[1fr_190px_190px_56px] lg:items-center">
          <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="font-bold text-text">{{ note.title }}</h3><UiStatusBadge :tone="categoryTone(note.category)">{{ categoryLabel(note.category) }}</UiStatusBadge></div><p class="mt-1 flex items-center gap-2 text-sm font-semibold text-muted"><UserRound class="h-4 w-4" />{{ note.person.name }}</p><p v-if="note.description" class="mt-1 line-clamp-2 text-sm text-muted">{{ note.description }}</p></div>
          <div><UiStatusBadge :tone="statusTone(note.status)">{{ statusLabel(note.status) }}</UiStatusBadge><p class="mt-2 text-xs text-muted">Registrado {{ new Date(`${note.occurred_on}T12:00:00`).toLocaleDateString('es-SV') }}</p></div>
          <p class="flex items-start gap-2 text-sm font-medium" :class="reminderClass(note.remind_at, note.status)"><CalendarClock class="mt-0.5 h-4 w-4 shrink-0" />{{ reminderLabel(note.remind_at) }}</p>
          <UiActionDropdown>
            <UiActionMenuItem v-if="note.status === 'pending'" @select="openEdit(note)"><template #icon><Pencil class="h-4 w-4" /></template>Editar</UiActionMenuItem>
            <UiActionMenuItem v-if="note.status === 'pending'" @select="openResolve(note)"><template #icon><Check class="h-4 w-4" /></template>Marcar resuelto</UiActionMenuItem>
            <UiActionMenuItem v-if="note.status === 'pending'" tone="danger" separated @select="openDiscard(note)"><template #icon><Archive class="h-4 w-4" /></template>Descartar por error</UiActionMenuItem>
          </UiActionDropdown>
        </article>
      </div>
      <div v-if="meta.last_page > 1" class="border-t border-line px-5 py-4">
        <BillingPaginationBar :meta="meta" :loading="loading" @page="goToNotesPage" />
      </div>
    </div>

    <BillingModalShell :open="formOpen" :title="editingNote ? 'Editar pendiente' : 'Nuevo pendiente'" description="Es una nota de seguimiento; no registra dinero, inventario ni ventas." max-width="max-w-2xl" @close="formOpen = false">
      <div class="relative"><UiSearchInput v-model="form.person_name" label="Persona" placeholder="Buscar cliente o escribir un nombre" /><div v-if="!selectedCustomer && (customerResults.length || customerLoading)" class="absolute z-20 mt-1 w-full rounded-md border border-line bg-surface-raised p-1 shadow-xl"><p v-if="customerLoading" class="px-3 py-2 text-sm text-soft">Buscando…</p><button v-for="customer in customerResults" :key="customer.id" type="button" class="block w-full rounded-md px-3 py-2 text-left hover:bg-primary-soft dark:hover:bg-surface-muted" @click="chooseCustomer(customer)"><strong class="block">{{ customer.name }}</strong><span class="text-xs text-muted">{{ customer.document_number || customer.phone || 'Cliente conocido' }}</span></button></div></div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2"><UiInput v-model="form.person_phone" label="Teléfono (opcional)" /><UiInput v-model="form.person_email" type="email" label="Correo (opcional)" /></div>
      <UiInput v-model="form.title" class="mt-4" label="¿Qué quedó pendiente?" placeholder="Ej. SIM entregada para prueba" />
      <UiTextarea v-model="form.description" class="mt-4" label="Detalle (opcional)" :rows="3" />
      <div class="mt-4 grid gap-4 sm:grid-cols-3"><UiSelect v-model="form.category" label="Categoría" :options="categoryOptions" /><UiInput v-model="form.occurred_on" type="date" label="Fecha" /><UiInput v-model="form.remind_at" type="datetime-local" label="Recordarme (opcional)" /></div>
      <template #footer><UiButton variant="secondary" @click="formOpen = false">Cancelar</UiButton><UiButton :disabled="saving || !canSave" @click="saveNote">Guardar</UiButton></template>
    </BillingModalShell>

    <BillingModalShell :open="Boolean(resolvingNote)" title="Resolver pendiente" description="La nota permanecerá disponible en el historial." @close="resolvingNote = null"><UiSelect v-model="resolution.resolution_type" label="¿Qué ocurrió?" :options="resolutionOptions" /><UiInput v-if="resolution.resolution_type === 'invoiced'" v-model="resolution.resolution_reference" class="mt-4" label="Referencia del DTE (opcional)" /><UiTextarea v-model="resolution.resolution_note" class="mt-4" label="Nota de cierre (opcional)" :rows="3" /><template #footer><UiButton variant="secondary" @click="resolvingNote = null">Volver</UiButton><UiButton :disabled="saving" @click="resolveNote">Marcar resuelto</UiButton></template></BillingModalShell>
    <BillingModalShell :open="Boolean(discardingNote)" title="Descartar nota" description="Indica por qué fue registrada por error. No se eliminará el historial." @close="discardingNote = null"><UiTextarea v-model="discardReason" label="Razón" :rows="3" /><template #footer><UiButton variant="secondary" @click="discardingNote = null">Volver</UiButton><UiButton variant="danger" :disabled="saving || discardReason.trim().length < 3" @click="discardNote">Descartar</UiButton></template></BillingModalShell>
  </section>
</template>
