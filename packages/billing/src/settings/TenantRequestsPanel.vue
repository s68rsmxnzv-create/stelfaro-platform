<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { CirclePlus, Copy, FileClock, KeyRound, Send } from 'lucide-vue-next';
import { PlatformClient, type PlatformTenantRequest, type PlatformTenantRequestStatus, type PlatformTenantRequestType } from '@stelfaro/api-client';
import { UiButton, UiEmailInput, UiInput, UiModalShell, UiPhoneInput, UiSelect, UiStatusBadge, UiTextarea } from '@stelfaro/ui';
import BillingFloatingToastStack, { type BillingFloatingToast } from '../components/BillingFloatingToastStack.vue';

const props = withDefaults(defineProps<{
  platformBaseUrl?: string;
  platformSession?: (Record<string, unknown> & { tenant?: { id?: number | string | null; name?: string | null; role?: string | null } | null }) | null;
}>(), { platformBaseUrl: '/api/v1', platformSession: null });

const client = new PlatformClient(props.platformBaseUrl, { credentials: 'include' });
const requests = ref<PlatformTenantRequest[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const modalOpen = ref(false);
const highlightedId = ref<number | null>(null);
const credentials = ref<{ email: string; temporary_password: string } | null>(null);
const toasts = ref<BillingFloatingToast[]>([]);
let toastId = 0;
const tenantId = computed(() => Number(props.platformSession?.tenant?.id || 0));
const canRequest = computed(() => ['owner', 'company_admin'].includes(String(props.platformSession?.tenant?.role || '')));
const form = reactive({ type: 'user_access' as PlatformTenantRequestType, subject: '', description: '', action: 'create', name: '', email: '', phone: '', role: 'billing_user', address: '', code: '' });

const typeOptions: Array<{ value: PlatformTenantRequestType; label: string }> = [
  { value: 'user_access', label: 'Usuario o acceso' }, { value: 'branch', label: 'Nueva sucursal' }, { value: 'point_of_sale', label: 'Punto de venta' },
  { value: 'fiscal_identity', label: 'Datos legales o fiscales' }, { value: 'certificate', label: 'Certificado electrónico' }, { value: 'mh_credentials', label: 'Credenciales MH' },
  { value: 'correlatives', label: 'Correlativos' }, { value: 'subscription', label: 'Suscripción' }, { value: 'app_access', label: 'Habilitar aplicación' },
  { value: 'data_migration', label: 'Migración de datos' }, { value: 'support', label: 'Soporte general' },
];
const roleOptions = [{ value: 'company_admin', label: 'Administrador de empresa' }, { value: 'billing_admin', label: 'Administrador de facturación' }, { value: 'billing_user', label: 'Facturación' }, { value: 'viewer', label: 'Solo consulta' }];
const actionOptions = [{ value: 'create', label: 'Crear usuario' }, { value: 'modify', label: 'Modificar acceso' }, { value: 'suspend', label: 'Suspender acceso' }];

onMounted(async () => {
  if (!canRequest.value) return;
  await load();
  const requestedId = Number(new URLSearchParams(window.location.search).get('request') || 0);
  if (!requests.value.some(item => item.id === requestedId)) return;
  highlightedId.value = requestedId;
  await nextTick();
  document.getElementById(`tenant-request-${requestedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => { if (highlightedId.value === requestedId) highlightedId.value = null; }, 2400);
});
watch(() => form.type, () => { form.subject = defaultSubject(form.type); });

async function load(): Promise<void> { if (!tenantId.value) return; loading.value = true; error.value = null; try { requests.value = (await client.tenantRequests(tenantId.value)).data; } catch (caught) { error.value = message(caught, 'No fue posible cargar las solicitudes.'); } finally { loading.value = false; } }

function openCreate(): void { reset(); modalOpen.value = true; }
function reset(): void { Object.assign(form, { type: 'user_access', subject: 'Crear o modificar usuario', description: '', action: 'create', name: '', email: '', phone: '', role: 'billing_user', address: '', code: '' }); }

async function submit(): Promise<void> {
  if (!tenantId.value || !form.subject.trim() || saving.value) return;
  saving.value = true; error.value = null;
  try {
    const payload: Record<string, unknown> = {};
    if (form.type === 'user_access') Object.assign(payload, { action: form.action, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, role: form.role });
    if (form.type === 'branch') Object.assign(payload, { name: form.name.trim(), address: form.address.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null });
    if (form.type === 'point_of_sale') Object.assign(payload, { name: form.name.trim(), code: form.code.trim(), address: form.address.trim() || null });
    const response = await client.createTenantRequest(tenantId.value, { idempotency_key: crypto.randomUUID(), type: form.type, subject: form.subject.trim(), description: form.description.trim() || null, payload });
    requests.value = [response.data, ...requests.value.filter(item => item.id !== response.data.id)]; modalOpen.value = false;
    notify('Solicitud enviada', `${response.data.reference} quedó pendiente de revisión.`);
  } catch (caught) { error.value = message(caught, 'No fue posible enviar la solicitud.'); }
  finally { saving.value = false; }
}

async function revealCredentials(item: PlatformTenantRequest): Promise<void> {
  if (!tenantId.value) return;
  error.value = null;
  try { credentials.value = (await client.revealTenantRequestCredentials(tenantId.value, item.id)).data; }
  catch (caught) { error.value = message(caught, 'No fue posible consultar las credenciales.'); }
}
async function copyCredentials(): Promise<void> {
  if (!credentials.value) return;
  await navigator.clipboard?.writeText(`Usuario: ${credentials.value.email}\nContraseña temporal: ${credentials.value.temporary_password}`);
  notify('Credenciales copiadas', 'Compártelas por un medio seguro.');
}

function defaultSubject(type: PlatformTenantRequestType): string { return ({ user_access: 'Crear o modificar usuario', branch: 'Crear nueva sucursal', point_of_sale: 'Crear punto de venta', fiscal_identity: 'Actualizar datos fiscales', certificate: 'Revisar certificado electrónico', mh_credentials: 'Revisar credenciales MH', correlatives: 'Revisar correlativos', subscription: 'Cambiar suscripción', app_access: 'Habilitar aplicación', data_migration: 'Solicitar migración de datos', support: 'Solicitud de soporte' } as Record<PlatformTenantRequestType, string>)[type]; }
function typeLabel(type: PlatformTenantRequestType): string { return typeOptions.find(item => item.value === type)?.label ?? type; }
function statusLabel(status: PlatformTenantRequestStatus): string { return ({ pending: 'Pendiente', in_review: 'En revisión', needs_information: 'Necesita información', approved: 'Aprobada', completed: 'Completada', rejected: 'Rechazada', cancelled: 'Cancelada' } as Record<PlatformTenantRequestStatus, string>)[status]; }
function statusTone(status: PlatformTenantRequestStatus): 'neutral'|'success'|'warning'|'danger'|'info' { if (['completed', 'approved'].includes(status)) return 'success'; if (status === 'rejected' || status === 'cancelled') return 'danger'; if (status === 'pending' || status === 'needs_information') return 'warning'; return 'info'; }
function date(value: string | null): string { return value ? new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '-'; }
function message(caught: unknown, fallback: string): string { return caught instanceof Error ? caught.message : fallback; }
function notify(title: string, detail: string): void { const id = ++toastId; toasts.value = [...toasts.value, { id, title, message: detail, variant: 'success' }]; window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4200); }
</script>

<template>
  <BillingFloatingToastStack :toasts="toasts" />
  <div v-if="!canRequest" class="rounded-xl border border-line bg-surface-muted p-6"><h2 class="font-bold text-text">Solicitudes administrativas</h2><p class="mt-2 text-sm text-muted">Solo el propietario o administrador de la empresa puede enviar y consultar solicitudes.</p></div>
  <template v-else>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div class="flex items-start gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary"><FileClock class="h-5 w-5" /></span><div><h2 class="font-bold text-text">Solicitudes de {{ platformSession?.tenant?.name }}</h2><p class="mt-1 text-sm text-muted">Pide usuarios, sucursales y cambios controlados; podrás seguir la respuesta desde aquí.</p></div></div><UiButton @click="openCreate"><CirclePlus class="h-4 w-4" />Nueva solicitud</UiButton></div>
    <div class="mt-6 space-y-3">
      <div v-if="loading" class="rounded-xl border border-line bg-surface p-5 text-sm text-muted">Cargando solicitudes...</div>
      <article v-for="item in requests" v-else :id="`tenant-request-${item.id}`" :key="item.id" class="rounded-xl border bg-surface p-4 transition sm:p-5" :class="highlightedId === item.id ? 'border-primary ring-4 ring-primary/15' : 'border-line'"><div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div class="flex flex-wrap items-center gap-2"><span class="font-mono text-xs font-bold text-primary">{{ item.reference }}</span><UiStatusBadge :tone="statusTone(item.status)">{{ statusLabel(item.status) }}</UiStatusBadge></div><h3 class="mt-2 font-bold text-text">{{ item.subject }}</h3><p class="mt-1 text-sm text-muted">{{ typeLabel(item.type) }} · {{ date(item.created_at) }}</p><p v-if="item.description" class="mt-3 text-sm leading-6 text-text">{{ item.description }}</p></div><span v-if="item.assignee" class="text-xs text-muted">Atiende: {{ item.assignee.name }}</span></div><div v-if="item.admin_response" class="mt-4 rounded-xl border border-primary/20 bg-primary-soft px-4 py-3"><p class="text-xs font-bold uppercase tracking-wide text-primary">Respuesta</p><p class="mt-1 text-sm text-text">{{ item.admin_response }}</p></div><div v-if="item.fulfillment" class="mt-4 flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between"><div><p class="font-semibold text-text">{{ item.fulfillment.user.name }}</p><p class="text-sm text-muted">{{ item.fulfillment.user.email }}</p></div><UiButton v-if="item.fulfillment.credentials_available" size="sm" variant="secondary" @click="revealCredentials(item)"><KeyRound class="h-4 w-4" />Ver credenciales</UiButton><UiStatusBadge v-else tone="success">Acceso habilitado</UiStatusBadge></div></article>
      <div v-if="!loading && requests.length === 0" class="rounded-xl border border-dashed border-line bg-surface-muted p-8 text-center text-sm text-muted">Aún no hay solicitudes para esta empresa.</div>
    </div>
  </template>
  <p v-if="error" class="mt-4 rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</p>

  <UiModalShell :open="modalOpen" title="Nueva solicitud" description="La solicitud llegará al panel administrativo de Stelfaro." max-width="max-w-2xl" @close="modalOpen = false">
    <div class="space-y-4"><UiSelect v-model="form.type" label="Tipo de solicitud" :options="typeOptions" /><UiInput v-model="form.subject" label="Asunto" />
      <template v-if="form.type === 'user_access'"><div class="grid gap-4 sm:grid-cols-2"><UiSelect v-model="form.action" label="Acción" :options="actionOptions" /><UiSelect v-model="form.role" label="Rol solicitado" :options="roleOptions" /><UiInput v-model="form.name" label="Nombre del usuario" /><UiEmailInput v-model="form.email" label="Correo del usuario" /><UiPhoneInput v-model="form.phone" label="Teléfono" /></div></template>
      <template v-else-if="form.type === 'branch'"><div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.name" label="Nombre de la sucursal" /><UiPhoneInput v-model="form.phone" label="Teléfono" /><UiEmailInput v-model="form.email" label="Correo" /><UiInput v-model="form.address" class="sm:col-span-2" label="Dirección" /></div></template>
      <template v-else-if="form.type === 'point_of_sale'"><div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.name" label="Nombre del punto de venta" /><UiInput v-model="form.code" label="Código sugerido" /><UiInput v-model="form.address" class="sm:col-span-2" label="Sucursal o ubicación relacionada" /></div></template>
      <UiTextarea v-model="form.description" label="Detalle" :rows="4" placeholder="Explica lo necesario para revisar y completar la solicitud." />
    </div>
    <template #footer><UiButton variant="secondary" :disabled="saving" @click="modalOpen = false">Volver</UiButton><UiButton :disabled="saving || !form.subject.trim()" @click="submit"><Send class="h-4 w-4" />{{ saving ? 'Enviando...' : 'Enviar solicitud' }}</UiButton></template>
  </UiModalShell>
  <UiModalShell :open="Boolean(credentials)" title="Credenciales temporales" description="Compártelas únicamente con la persona autorizada." @close="credentials = null"><div v-if="credentials" class="space-y-3"><div class="rounded-xl border border-line bg-surface-muted p-4"><p class="text-xs font-bold uppercase text-soft">Usuario</p><p class="mt-1 font-semibold text-text">{{ credentials.email }}</p><p class="mt-4 text-xs font-bold uppercase text-soft">Contraseña temporal</p><p class="mt-1 rounded-lg bg-surface px-3 py-2 font-mono text-text">{{ credentials.temporary_password }}</p></div><p class="text-sm text-muted">La contraseña dejará de ser útil cuando el usuario la cambie al iniciar sesión.</p></div><template #footer><UiButton variant="secondary" @click="credentials = null">Cerrar</UiButton><UiButton @click="copyCredentials"><Copy class="h-4 w-4" />Copiar credenciales</UiButton></template></UiModalShell>
</template>
