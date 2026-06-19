<script setup lang="ts">
import UiCloseCircleIcon from './UiCloseCircleIcon.vue';

withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string | null;
  maxWidth?: string;
  closeLabel?: string;
  closeOnBackdrop?: boolean;
}>(), {
  description: null,
  maxWidth: 'max-w-2xl',
  closeLabel: 'Cerrar',
  closeOnBackdrop: true
});

const emit = defineEmits<{
  close: [];
}>();

function closeFromBackdrop(closeOnBackdrop: boolean): void {
  if (closeOnBackdrop) {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      @click.self="closeFromBackdrop(closeOnBackdrop)"
    >
      <section
        class="w-full rounded-md border border-blue-100 bg-white shadow-2xl shadow-slate-950/25"
        :class="maxWidth"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0">
            <p class="text-lg font-bold text-slate-950">{{ title }}</p>
            <p v-if="description" class="mt-1 text-sm text-slate-500">{{ description }}</p>
          </div>
          <button
            type="button"
            class="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            :aria-label="closeLabel"
            @click="emit('close')"
          >
            <UiCloseCircleIcon class="h-6 w-6" />
          </button>
        </header>

        <div class="px-5 py-5">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
