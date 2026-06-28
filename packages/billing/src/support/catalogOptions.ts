export type CatalogOption = {
  value: string;
  label: string;
  hint?: string;
};

export const catalogItemTypeOptions: CatalogOption[] = [
  { value: 'product', label: 'Producto', hint: 'Bien vendido o comprado' },
  { value: 'service', label: 'Servicio', hint: 'No controla inventario' },
  { value: 'part', label: 'Repuesto', hint: 'Puede controlar inventario' },
  { value: 'labor', label: 'Mano de obra', hint: 'No controla inventario' },
  { value: 'other', label: 'Otro', hint: 'Uso operativo especial' }
];

export const catalogStatusOptions: CatalogOption[] = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' }
];

export const fiscalUnitMeasureOptions: CatalogOption[] = [
  { value: '1', label: 'metro', hint: 'CAT-014 1' },
  { value: '2', label: 'Yarda', hint: 'CAT-014 2' },
  { value: '6', label: 'milímetro', hint: 'CAT-014 6' },
  { value: '9', label: 'kilómetro cuadrado', hint: 'CAT-014 9' },
  { value: '10', label: 'Hectárea', hint: 'CAT-014 10' },
  { value: '13', label: 'metro cuadrado', hint: 'CAT-014 13' },
  { value: '15', label: 'Vara cuadrada', hint: 'CAT-014 15' },
  { value: '18', label: 'metro cúbico', hint: 'CAT-014 18' },
  { value: '20', label: 'Barril', hint: 'CAT-014 20' },
  { value: '22', label: 'Galón', hint: 'CAT-014 22' },
  { value: '23', label: 'Litro', hint: 'CAT-014 23' },
  { value: '24', label: 'Botella', hint: 'CAT-014 24' },
  { value: '26', label: 'Mililitro', hint: 'CAT-014 26' },
  { value: '30', label: 'Tonelada', hint: 'CAT-014 30' },
  { value: '32', label: 'Quintal', hint: 'CAT-014 32' },
  { value: '33', label: 'Arroba', hint: 'CAT-014 33' },
  { value: '34', label: 'Kilogramo', hint: 'CAT-014 34' },
  { value: '36', label: 'Libra', hint: 'CAT-014 36' },
  { value: '37', label: 'Onza troy', hint: 'CAT-014 37' },
  { value: '38', label: 'Onza', hint: 'CAT-014 38' },
  { value: '39', label: 'Gramo', hint: 'CAT-014 39' },
  { value: '40', label: 'Miligramo', hint: 'CAT-014 40' },
  { value: '42', label: 'Megawatt', hint: 'CAT-014 42' },
  { value: '43', label: 'Kilowatt', hint: 'CAT-014 43' },
  { value: '44', label: 'Watt', hint: 'CAT-014 44' },
  { value: '45', label: 'Megavoltio-amperio', hint: 'CAT-014 45' },
  { value: '46', label: 'Kilovoltio-amperio', hint: 'CAT-014 46' },
  { value: '47', label: 'Voltio-amperio', hint: 'CAT-014 47' },
  { value: '49', label: 'Gigawatt-hora', hint: 'CAT-014 49' },
  { value: '50', label: 'Megawatt-hora', hint: 'CAT-014 50' },
  { value: '51', label: 'Kilowatt-hora', hint: 'CAT-014 51' },
  { value: '52', label: 'Watt-hora', hint: 'CAT-014 52' },
  { value: '53', label: 'Kilovoltio', hint: 'CAT-014 53' },
  { value: '54', label: 'Voltio', hint: 'CAT-014 54' },
  { value: '55', label: 'Millar', hint: 'CAT-014 55' },
  { value: '56', label: 'Medio millar', hint: 'CAT-014 56' },
  { value: '57', label: 'Ciento', hint: 'CAT-014 57' },
  { value: '58', label: 'Docena', hint: 'CAT-014 58' },
  { value: '59', label: 'Unidad', hint: 'CAT-014 59' },
  { value: '99', label: 'Otra', hint: 'CAT-014 99' }
];

