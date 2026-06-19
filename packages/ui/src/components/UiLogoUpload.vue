<script setup lang="ts">
defineOptions({
  inheritAttrs: false
});

withDefaults(defineProps<{
  id: string;
  label?: string;
  title?: string;
  hint?: string;
  selectedLabel?: string | null;
  previewSrc?: string | null;
  accept?: string;
}>(), {
  label: 'Logo',
  title: 'Subir logo',
  hint: 'Arrastra o selecciona una imagen SVG, PNG, JPG o GIF.',
  selectedLabel: null,
  previewSrc: null,
  accept: 'image/*'
});

const emit = defineEmits<{
  change: [event: Event];
  imageError: [];
}>();
</script>

<template>
  <label class="block">
    <span class="text-sm font-medium text-slate-700">{{ label }}</span>

    <span
      class="mt-1 flex w-full max-w-lg cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 text-center shadow-sm shadow-blue-950/5 transition hover:border-sky-300 hover:bg-sky-50/70"
    >
      <span class="grid h-20 w-20 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <img
          v-if="previewSrc"
          :src="previewSrc"
          class="h-full w-full object-contain"
          alt=""
          @error="emit('imageError')"
        >
        <svg v-else class="h-9 w-9 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
        </svg>
      </span>

      <span class="mt-3 max-w-full truncate text-sm font-semibold text-slate-950">
        {{ selectedLabel || (previewSrc ? 'Cambiar logo' : title) }}
      </span>
      <span class="mt-1 max-w-sm text-xs leading-5 text-slate-500">{{ hint }}</span>

      <input
        :id="id"
        v-bind="$attrs"
        class="sr-only"
        type="file"
        :accept="accept"
        @change="emit('change', $event)"
      >
    </span>
  </label>
</template>
