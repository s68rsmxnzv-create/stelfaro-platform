<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { Camera, ChevronLeft, ChevronRight, Images, RefreshCw, X } from 'lucide-vue-next';
import { UiButton } from '@stelfaro/ui';
import type { WorkshopOrderPhoto } from '@stelfaro/api-client';

const props = defineProps<{ photos: WorkshopOrderPhoto[]; loading?: boolean; allowAdd?: boolean }>();
defineEmits<{ refresh: []; addPhotos: [] }>();
const selectedIndex = ref<number | null>(null);
const selected = computed(() => selectedIndex.value === null ? null : props.photos[selectedIndex.value] ?? null);
function select(index: number) { selectedIndex.value = index; }
function close() { selectedIndex.value = null; }
function move(offset: number) {
  if (selectedIndex.value === null || !props.photos.length) return;
  selectedIndex.value = (selectedIndex.value + offset + props.photos.length) % props.photos.length;
}
function handleKeydown(event: KeyboardEvent) { if (!selected.value) return; if (event.key === 'Escape') close(); else if (event.key === 'ArrowLeft') move(-1); else if (event.key === 'ArrowRight') move(1); }
function size(bytes: number) { return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <section class="mt-7 border-t border-line pt-7">
    <div class="flex items-end justify-between gap-4">
      <div>
        <p class="text-sm font-semibold uppercase tracking-wide text-primary">Vista previa</p>
        <h3 class="mt-1 text-2xl font-bold text-text">Fotografías del equipo</h3>
        <p class="mt-2 text-sm text-muted">Haz clic en una fotografía para abrirla y navegar por la galería.</p>
      </div>
      <div class="flex flex-wrap gap-2"><UiButton v-if="allowAdd" @click="$emit('addPhotos')"><Camera class="mr-2 h-4 w-4" />{{ photos.length ? 'Agregar fotos' : 'Agregar primera foto' }}</UiButton><UiButton variant="secondary" :disabled="loading" @click="$emit('refresh')"><RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': loading }" />Actualizar</UiButton></div>
    </div>

    <div v-if="photos.length" class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <button v-for="(photo, index) in photos" :key="photo.id" type="button" class="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-muted text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary" @click="select(index)">
        <img :src="photo.url" alt="" aria-hidden="true" class="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl" loading="lazy">
        <div class="absolute inset-0 bg-black/10"></div>
        <img :src="photo.url" :alt="`Fotografía ${photos.length - index} del equipo`" class="relative h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" loading="lazy">
        <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-10 text-white">
          <strong class="block truncate text-sm">Fotografía {{ photos.length - index }}</strong><small class="mt-0.5 block text-white/75">{{ size(photo.size) }}</small>
        </span>
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
