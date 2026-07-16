<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { RotateCcw } from 'lucide-vue-next';
import { UiButton } from '@stelfaro/ui';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const points = [{id:1,x:30,y:30},{id:2,x:100,y:30},{id:3,x:170,y:30},{id:4,x:30,y:100},{id:5,x:100,y:100},{id:6,x:170,y:100},{id:7,x:30,y:170},{id:8,x:100,y:170},{id:9,x:170,y:170}];
const sequence = computed(() => props.modelValue.split('-').filter(Boolean).map(Number));
const board = ref<SVGSVGElement | null>(null);
const drawing = ref(false);
const cursor = ref<{x:number;y:number}|null>(null);
const linePoints = computed(() => [...sequence.value.map(id => { const point = points.find(item => item.id === id); return point ? `${point.x},${point.y}` : ''; }).filter(Boolean), ...(drawing.value && cursor.value ? [`${cursor.value.x},${cursor.value.y}`] : [])].join(' '));
function add(id: number) { if (!sequence.value.includes(id)) emit('update:modelValue', [...sequence.value, id].join('-')); }
function position(event: PointerEvent) { const rect = board.value?.getBoundingClientRect(); if (!rect) return null; return {x:(event.clientX-rect.left)*200/rect.width,y:(event.clientY-rect.top)*200/rect.height}; }
function start(event: PointerEvent, id: number) { drawing.value = true; emit('update:modelValue', String(id)); cursor.value = position(event); board.value?.setPointerCapture(event.pointerId); }
function move(event: PointerEvent) { if (!drawing.value) return; const current = position(event); if (!current) return; cursor.value = current; const nearest = points.find(point => Math.hypot(point.x-current.x, point.y-current.y) <= 22); if (nearest) add(nearest.id); }
function finish() { drawing.value = false; cursor.value = null; }
onBeforeUnmount(() => finish());
</script>
<template><div><div class="mx-auto w-fit rounded-xl border border-line bg-surface-muted p-3"><svg ref="board" class="h-52 w-52 touch-none select-none" viewBox="0 0 200 200" aria-label="Patrón de desbloqueo" @pointermove="move" @pointerup="finish" @pointercancel="finish"><polyline :points="linePoints" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="text-primary"/><g v-for="point in points" :key="point.id" role="button" tabindex="0" @pointerdown.prevent="start($event, point.id)" @keydown.enter="add(point.id)"><circle :cx="point.x" :cy="point.y" r="19" class="cursor-pointer stroke-primary" :class="sequence.includes(point.id) ? 'fill-primary-soft' : 'fill-surface'" stroke-width="2"/><circle :cx="point.x" :cy="point.y" r="6" class="pointer-events-none fill-primary"/></g></svg></div><div class="mt-2 flex items-center justify-between"><span class="text-xs text-muted">{{ sequence.length ? `${sequence.length} puntos seleccionados` : 'Dibuja un patrón de al menos 4 puntos' }}</span><UiButton type="button" size="sm" variant="ghost" @click="emit('update:modelValue', '')"><RotateCcw class="mr-1 h-4 w-4"/>Rehacer</UiButton></div></div></template>
