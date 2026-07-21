<script setup lang="ts">
import { PlatformClient, type BillingSucursal, type PlatformCashRegisterSettings } from '@stelfaro/api-client';
import { UiButton, UiInput, UiSelect, UiToggle } from '@stelfaro/ui';
import { Banknote, CalendarDays, Clock3, RefreshCw } from 'lucide-vue-next';
import { computed, onMounted, reactive, ref } from 'vue';
import BillingFloatingToastStack from '../components/BillingFloatingToastStack.vue';

const props = withDefaults(defineProps<{ tenantId: number; platformBaseUrl?: string; authToken?: string|null; branches?: BillingSucursal[] }>(), { platformBaseUrl: '/api/v1', authToken: null, branches: () => [] });
const client = computed(() => new PlatformClient(props.platformBaseUrl, { authToken: props.authToken }));
const rows = ref<PlatformCashRegisterSettings[]>([]); const selectedBranchId = ref(''); const loading = ref(false); const toasts = ref<any[]>([]);
const form = reactive({ name: 'Caja principal', timezone: 'America/El_Salvador', default_opening_balance: 0, carry_forward_balance: true, auto_open_enabled: false, auto_open_time: '08:00', auto_close_enabled: false, auto_close_time: '18:00', close_grace_minutes: 15, working_days: [1,2,3,4,5,6] as number[], non_working_dates_text: '', use_official_holidays: true, allow_non_cash_when_closed: true, active: true });
const branchOptions = computed(() => props.branches.map(branch => ({ value: String(branch.id), label: `${branch.codigo} · ${branch.nombre}` })));
const selectedBranch = computed(() => props.branches.find(branch => String(branch.id) === selectedBranchId.value) ?? props.branches[0] ?? null);
const current = computed(() => rows.value.find(row => Number(row.core_sucursal_id) === Number(selectedBranch.value?.id)) ?? null);
const weekdays = [{id:1,label:'Lun'},{id:2,label:'Mar'},{id:3,label:'Mié'},{id:4,label:'Jue'},{id:5,label:'Vie'},{id:6,label:'Sáb'},{id:7,label:'Dom'}];

function notify(title:string, message:string, variant='success') { const id=`${Date.now()}-${Math.random()}`; toasts.value.push({id,title,message,variant}); window.setTimeout(() => toasts.value = toasts.value.filter(item => item.id !== id), 4200); }
function errorMessage(error:any) { return error?.response?.message || error?.message || 'Revisa los datos e intenta nuevamente.'; }
function applyRow(row: PlatformCashRegisterSettings|null) { const settings=row?.settings; Object.assign(form, { name: row?.name || `Caja ${selectedBranch.value?.nombre || 'principal'}`, timezone: settings?.timezone || 'America/El_Salvador', default_opening_balance: settings?.default_opening_balance || 0, carry_forward_balance: settings?.carry_forward_balance ?? true, auto_open_enabled: settings?.auto_open_enabled ?? false, auto_open_time: settings?.auto_open_time || '08:00', auto_close_enabled: settings?.auto_close_enabled ?? false, auto_close_time: settings?.auto_close_time || '18:00', close_grace_minutes: settings?.close_grace_minutes ?? 15, working_days: settings?.working_days || [1,2,3,4,5,6], non_working_dates_text: (settings?.non_working_dates || []).join(', '), use_official_holidays: settings?.use_official_holidays ?? true, allow_non_cash_when_closed: settings?.allow_non_cash_when_closed ?? true, active: settings?.active ?? true }); }
async function load() { if (!props.tenantId) return; loading.value=true; try { rows.value=(await client.value.cashSettings(props.tenantId)).data; if (!selectedBranchId.value && props.branches[0]) selectedBranchId.value=String(props.branches[0].id); applyRow(current.value); } catch(error) { notify('No pudimos cargar Caja', errorMessage(error), 'error'); } finally { loading.value=false; } }
function toggleDay(day:number) { form.working_days = form.working_days.includes(day) ? form.working_days.filter(value => value !== day) : [...form.working_days, day].sort(); }
async function save() { if (!selectedBranch.value) return; loading.value=true; const payload={ name:form.name, timezone:form.timezone, default_opening_balance:Number(form.default_opening_balance), carry_forward_balance:form.carry_forward_balance, auto_open_enabled:form.auto_open_enabled, auto_open_time:form.auto_open_enabled ? form.auto_open_time : null, auto_close_enabled:form.auto_close_enabled, auto_close_time:form.auto_close_enabled ? form.auto_close_time : null, close_grace_minutes:Number(form.close_grace_minutes), working_days:form.working_days, non_working_dates:form.non_working_dates_text.split(/[\s,;]+/).map(value => value.trim()).filter(Boolean), use_official_holidays:form.use_official_holidays, allow_non_cash_when_closed:form.allow_non_cash_when_closed, active:form.active };
  try { if (current.value) await client.value.updateCashSettings(props.tenantId, current.value.id, payload); else await client.value.createCashSettings(props.tenantId, { ...payload, core_sucursal_id:selectedBranch.value.id, core_sucursal_code:selectedBranch.value.codigo, core_sucursal_name:selectedBranch.value.nombre }); notify('Configuración guardada', `Caja quedó preparada para ${selectedBranch.value.nombre}.`); await load(); } catch(error) { notify('No se pudo guardar', errorMessage(error), 'error'); } finally { loading.value=false; } }
function selectBranch() { applyRow(current.value); }
onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <BillingFloatingToastStack :toasts="toasts" />
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><UiSelect v-model="selectedBranchId" class="w-full sm:max-w-md" label="Sucursal" :options="branchOptions" @update:model-value="selectBranch" /><UiButton variant="ghost" :disabled="loading" @click="load"><RefreshCw class="h-4 w-4" :class="loading ? 'animate-spin' : ''" />Actualizar</UiButton></div>
    <div v-if="selectedBranch" class="grid gap-5 xl:grid-cols-2">
      <section class="space-y-5 rounded-xl border border-line bg-surface-muted p-5">
        <div class="flex items-center gap-3"><span class="rounded-lg bg-primary-soft p-2 text-primary"><Banknote class="h-5 w-5" /></span><div><h3 class="font-bold text-text">Caja de la sucursal</h3><p class="text-sm text-muted">El control es independiente para cada ubicación.</p></div></div>
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.name" label="Nombre" /><UiInput v-model.number="form.default_opening_balance" type="number" min="0" step="0.01" label="Fondo inicial predeterminado" suffix="USD" /></div>
        <div class="grid gap-3 sm:grid-cols-2"><label class="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4"><span><strong class="block text-sm text-text">Arrastrar saldo</strong><small class="text-muted">Usa el último cierre confirmado.</small></span><UiToggle v-model="form.carry_forward_balance" /></label><label class="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4"><span><strong class="block text-sm text-text">Medios sin efectivo</strong><small class="text-muted">Permite tarjeta o transferencia sin caja abierta.</small></span><UiToggle v-model="form.allow_non_cash_when_closed" /></label></div>
      </section>
      <section class="space-y-5 rounded-xl border border-line bg-surface-muted p-5">
        <div class="flex items-center gap-3"><Clock3 class="h-5 w-5 text-primary" /><div><h3 class="font-bold text-text">Apertura y corte</h3><p class="text-sm text-muted">El corte automático queda pendiente de conteo humano.</p></div></div>
        <div class="grid gap-4 sm:grid-cols-2"><label class="rounded-lg border border-line bg-surface p-4"><span class="flex items-center justify-between font-semibold text-text">Abrir automáticamente <UiToggle v-model="form.auto_open_enabled" /></span><UiInput v-if="form.auto_open_enabled" v-model="form.auto_open_time" class="mt-3" type="time" label="Hora" /></label><label class="rounded-lg border border-line bg-surface p-4"><span class="flex items-center justify-between font-semibold text-text">Corte automático <UiToggle v-model="form.auto_close_enabled" /></span><div v-if="form.auto_close_enabled" class="mt-3 grid grid-cols-2 gap-2"><UiInput v-model="form.auto_close_time" type="time" label="Hora" /><UiInput v-model.number="form.close_grace_minutes" type="number" min="0" max="180" label="Gracia" suffix="min" /></div></label></div>
      </section>
      <section class="space-y-5 rounded-xl border border-line bg-surface-muted p-5 xl:col-span-2">
        <div class="flex items-center gap-3"><CalendarDays class="h-5 w-5 text-primary" /><div><h3 class="font-bold text-text">Días de operación</h3><p class="text-sm text-muted">Sábados y domingos solo se incluyen si los seleccionas.</p></div></div>
        <div class="flex flex-wrap gap-2"><button v-for="day in weekdays" :key="day.id" type="button" class="rounded-full border px-4 py-2 text-sm font-semibold transition" :class="form.working_days.includes(day.id) ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-primary/50'" @click="toggleDay(day.id)">{{ day.label }}</button></div>
        <div class="grid gap-4 sm:grid-cols-2"><UiInput v-model="form.non_working_dates_text" label="Fechas no laborables" placeholder="2026-08-06, 2026-12-24" /><label class="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-4"><span><strong class="block text-sm text-text">Usar asuetos oficiales</strong><small class="text-muted">Toma las fechas publicadas en el calendario administrativo.</small></span><UiToggle v-model="form.use_official_holidays" /></label></div>
        <div class="flex justify-end"><UiButton :disabled="loading || !form.working_days.length" @click="save">Guardar configuración</UiButton></div>
      </section>
    </div>
    <div v-else class="rounded-xl border border-warning/30 bg-warning-soft p-5 text-sm text-warning">Configura primero una sucursal en los datos fiscales de la empresa.</div>
  </div>
</template>
