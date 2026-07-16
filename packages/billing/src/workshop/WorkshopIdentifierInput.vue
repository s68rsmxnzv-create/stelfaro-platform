<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const normalized = computed(() => props.modelValue.trim());
const detectedType = computed(() => /^\d{14,15}$/.test(normalized.value) ? 'IMEI' : normalized.value ? 'SERIAL' : '');
const suggestion = computed(() => /^\d{14}$/.test(normalized.value) ? String(checkDigit(normalized.value)) : '');
function checkDigit(base: string) { let sum = 0; [...base].forEach((digit, index) => { let value = Number(digit) * (index % 2 === 1 ? 2 : 1); sum += Math.floor(value / 10) + value % 10; }); return (10 - sum % 10) % 10; }
function update(value: string) { emit('update:modelValue', /^\d+\s?$/.test(value) ? value.replace(/\s/g, '') : value); }
function complete(event: KeyboardEvent) { if (!suggestion.value) return; event.preventDefault(); emit('update:modelValue', `${normalized.value}${suggestion.value}`); }
</script>
<template><label class="block"><span class="text-sm font-medium text-slate-700 dark:text-muted">IMEI o serial</span><span class="relative mt-1 block"><span v-if="suggestion && !disabled" class="pointer-events-none absolute inset-y-0 left-3 flex items-center overflow-hidden pr-20 text-sm"><span class="invisible whitespace-pre">{{ modelValue }}</span><span class="text-soft">{{ suggestion }}</span></span><input :value="modelValue" :disabled="disabled" placeholder="IMEI o número de serie" class="h-12 w-full rounded-md border border-blue-100 bg-white/90 px-3 pr-24 text-sm text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 dark:border-line dark:bg-surface-raised dark:text-text dark:placeholder:text-soft dark:focus:ring-primary-soft dark:disabled:bg-surface-muted" @input="update(($event.target as HTMLInputElement).value)" @keydown.space="complete"><span v-if="detectedType" class="absolute inset-y-0 right-3 flex items-center"><span class="rounded-full px-2 py-1 text-[11px] font-bold" :class="detectedType === 'IMEI' ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-muted'">{{ detectedType }}</span></span></span><span v-if="suggestion && !disabled" class="mt-1 block text-xs text-muted">Presiona Espacio para completar el dígito verificador.</span></label></template>
