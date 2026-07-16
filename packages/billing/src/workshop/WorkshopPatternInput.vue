<script setup lang="ts">
import { computed } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import { UiButton } from '@stelfaro/ui';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const points = [{id:1,x:30,y:30},{id:2,x:100,y:30},{id:3,x:170,y:30},{id:4,x:30,y:100},{id:5,x:100,y:100},{id:6,x:170,y:100},{id:7,x:30,y:170},{id:8,x:100,y:170},{id:9,x:170,y:170}];
const sequence = computed(() => props.modelValue.split('-').filter(Boolean).map(Number));
const linePoints = computed(() => sequence.value.map(id => { const point = points.find(item => item.id === id); return point ? `${point.x},${point.y}` : ''; }).filter(Boolean).join(' '));
function add(id: number) { if (!sequence.value.includes(id)) emit('update:modelValue', [...sequence.value, id].join('-')); }
</script>
<template><div><div class="mx-auto w-fit rounded-xl border border-line bg-surface-muted p-3"><svg class="h-52 w-52 touch-none" viewBox="0 0 200 200" aria-label="Patrón de desbloqueo"><polyline :points="linePoints" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="text-primary"/><g v-for="point in points" :key="point.id" role="button" tabindex="0" @click="add(point.id)" @keydown.enter="add(point.id)"><circle :cx="point.x" :cy="point.y" r="19" class="cursor-pointer stroke-primary" :class="sequence.includes(point.id) ? 'fill-primary-soft' : 'fill-surface'" stroke-width="2"/><circle :cx="point.x" :cy="point.y" r="6" class="fill-primary"/></g></svg></div><div class="mt-2 flex items-center justify-between"><span class="text-xs text-muted">{{ sequence.length ? `${sequence.length} puntos seleccionados` : 'Selecciona al menos 4 puntos' }}</span><UiButton type="button" size="sm" variant="ghost" @click="emit('update:modelValue', '')"><RotateCcw class="mr-1 h-4 w-4"/>Rehacer</UiButton></div></div></template>
