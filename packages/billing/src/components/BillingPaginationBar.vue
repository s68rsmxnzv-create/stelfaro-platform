<script setup lang="ts">
import { computed } from 'vue';

type PageItem = number | 'ellipsis';

/**
 * Forma minima comun a todas las paginaciones del backend: algunas
 * respuestas (PaginationMeta del api-client) traen from/to/per_page, otras
 * (listados armados a mano en el frontend) solo current_page/last_page/total.
 * El componente se adapta a lo que reciba.
 */
export type BillingPaginationMeta = {
  current_page: number;
  last_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
};

const props = withDefaults(defineProps<{
  meta: BillingPaginationMeta | null;
  loading?: boolean;
}>(), {
  loading: false
});

const emit = defineEmits<{
  (event: 'page', page: number): void;
}>();

const currentPage = computed(() => props.meta?.current_page ?? 1);
const lastPage = computed(() => props.meta?.last_page ?? 1);
const paginationItems = computed<PageItem[]>(() => pageItems(lastPage.value, currentPage.value));

function pageItems(last: number, page: number): PageItem[] {
  if (last <= 7) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const pages = new Set([1, 2, last - 1, last, page - 1, page, page + 1]);
  const visible = [...pages]
    .filter((item) => item >= 1 && item <= last)
    .sort((a, b) => a - b);
  const items: PageItem[] = [];

  for (const item of visible) {
    const previous = items[items.length - 1];
    if (typeof previous === 'number' && item - previous > 1) {
      items.push('ellipsis');
    }
    items.push(item);
  }

  return items;
}

function goTo(page: number): void {
  const next = Math.min(Math.max(page, 1), lastPage.value);
  if (next === currentPage.value) return;
  emit('page', next);
}
</script>

<template>
  <div
    v-if="meta && meta.last_page > 1"
    class="flex items-center justify-between gap-3"
  >
    <p class="text-sm text-muted">
      <template v-if="meta.from != null && meta.to != null">{{ meta.from }}-{{ meta.to }} de {{ meta.total }}</template>
      <template v-else>Página {{ meta.current_page }} de {{ meta.last_page }} · {{ meta.total }} resultados</template>
    </p>

    <nav class="flex items-center" aria-label="Paginacion">
      <button
        type="button"
        class="mx-1 flex h-10 min-w-10 items-center justify-center rounded-md bg-surface px-3 py-2 text-soft transition-colors duration-300 disabled:cursor-not-allowed disabled:text-soft disabled:hover:bg-surface disabled:hover:text-soft hover:bg-primary hover:text-primary-contrast"
        :disabled="currentPage <= 1 || loading"
        aria-label="Pagina anterior"
        @click="goTo(currentPage - 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>

      <template v-for="(item, index) in paginationItems" :key="`${item}-${index}`">
        <span
          v-if="item === 'ellipsis'"
          class="mx-1 hidden h-10 min-w-10 items-center justify-center rounded-md bg-surface px-4 py-2 text-soft sm:inline-flex"
        >
          ...
        </span>

        <button
          v-else
          type="button"
          class="mx-1 hidden h-10 min-w-10 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition-colors duration-300 sm:inline-flex"
          :class="item === currentPage ? 'bg-primary text-primary-contrast' : 'bg-surface text-muted hover:bg-primary hover:text-primary-contrast'"
          :aria-current="item === currentPage ? 'page' : undefined"
          :disabled="loading"
          @click="goTo(item)"
        >
          {{ item }}
        </button>
      </template>

      <button
        type="button"
        class="mx-1 flex h-10 min-w-10 items-center justify-center rounded-md bg-surface px-3 py-2 text-muted transition-colors duration-300 disabled:cursor-not-allowed disabled:text-soft disabled:hover:bg-surface disabled:hover:text-soft hover:bg-primary hover:text-primary-contrast"
        :disabled="currentPage >= lastPage || loading"
        aria-label="Pagina siguiente"
        @click="goTo(currentPage + 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
      </button>
    </nav>
  </div>
</template>
