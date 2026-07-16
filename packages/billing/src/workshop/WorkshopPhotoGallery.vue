<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight, Images, RefreshCw, X } from 'lucide-vue-next';
import { UiButton } from '@stelfaro/ui';
import type { WorkshopOrderPhoto } from '@stelfaro/api-client';

const props = defineProps<{ photos: WorkshopOrderPhoto[]; loading?: boolean }>();
defineEmits<{ refresh: [] }>();
const selectedIndex = ref<number | null>(null);
const selected = computed(() => selectedIndex.value === null ? null : props.photos[selectedIndex.value] ?? null);
function select(index: number) { selectedIndex.value = index; }
function close() { selectedIndex.value = null; }
function move(offset: number) {
  if (selectedIndex.value === null || !props.photos.length) return;
  selectedIndex.value = (selectedIndex.value + offset + props.photos.length) % props.photos.length;
}
function size(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
</script>

<template>
  <section class="mt-7 border-t border-line pt-6">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary"><Images class="h-5 w-5" /></span>
        <div><h3 class="font-semibold text-text">Fotos del equipo</h3><p class="text-sm text-muted">{{ photos.length }} {{ photos.length === 1 ? 'fotografía guardada' : 'fotografías guardadas' }}</p></div>
      </div>
      <UiButton variant="secondary" :disabled="loading" @click="$emit('refresh')"><RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />Actualizar</UiButton>
    </div>

    <div v-if="photos.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <button v-for="(photo, index) in photos" :key="photo.id" type="button" class="group overflow-hidden rounded-lg border border-line bg-surface-muted text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary" @click="select(index)">
        <div class="aspect-[4/3] overflow-hidden bg-surface"><img :src="photo.url" :alt="`Foto ${index + 1} del equipo`" class="h-full w-full object-contain transition group-hover:scale-[1.02]" loading="lazy"></div>
        <div class="px-3 py-2"><p class="truncate text-xs font-medium text-text">Foto {{ photos.length - index }}</p><p class="mt-0.5 text-xs text-muted">{{ size(photo.size) }}</p></div>
      </button>
    </div>
    <div v-else class="mt-4 rounded-lg border border-dashed border-line bg-surface-muted px-4 py-8 text-center"><Images class="mx-auto h-8 w-8 text-muted" /><p class="mt-2 text-sm font-medium text-text">Aún no hay fotografías</p><p class="mt-1 text-xs text-muted">Después de subirlas desde el QR, pulsa Actualizar.</p></div>

    <Teleport to="body">
      <div v-if="selected" class="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Vista ampliada de fotografía" @click.self="close">
        <button type="button" class="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20" aria-label="Cerrar" @click="close"><X class="h-6 w-6" /></button>
        <button v-if="photos.length > 1" type="button" class="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6" aria-label="Foto anterior" @click="move(-1)"><ChevronLeft class="h-7 w-7" /></button>
        <img :src="selected.url" alt="Foto ampliada del equipo" class="max-h-[85vh] max-w-[88vw] object-contain">
        <button v-if="photos.length > 1" type="button" class="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6" aria-label="Foto siguiente" @click="move(1)"><ChevronRight class="h-7 w-7" /></button>
        <p class="absolute bottom-4 rounded-full bg-black/60 px-3 py-1 text-sm text-white">{{ (selectedIndex ?? 0) + 1 }} / {{ photos.length }}</p>
      </div>
    </Teleport>
  </section>
</template>
