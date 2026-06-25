import { type ModuleSection, KEYBOARD_SECTION_ID } from './sections';

export { KEYBOARD_SECTION_ID } from './sections';
export type { ModuleSection } from './sections';

// Índice de módulos de MAKWIL para el menú del nav inferior. El ORDEN debe coincidir con el
// orden de render de los .module en Makwil.tsx (sin batería). El último (teclado) vive fuera
// del grid.
// El ORDEN coincide con el render real de los .module en Makwil.tsx: Ruido va tras VCO4 y
// DAHD tras ADSR (antes de AD1-3). El campo `family` colorea cada ítem del menú.
export const MAKWIL_MODULE_SECTIONS: ModuleSection[] = [
  { id: 'mod-vco1', label: 'VCO 1', family: 'red' },
  { id: 'mod-vco2', label: 'VCO 2', family: 'red' },
  { id: 'mod-vco3', label: 'VCO 3', family: 'red' },
  { id: 'mod-vco4', label: 'VCO 4', family: 'red' },
  { id: 'mod-noise', label: 'Ruido', family: 'red' },
  { id: 'mod-vcf', label: 'VCF', family: 'amber' },
  { id: 'mod-vcf2', label: 'VCF 2', family: 'amber' },
  { id: 'mod-vcf3', label: 'VCF 3', family: 'amber' },
  { id: 'mod-mixer', label: 'Mixer', family: 'jade' },
  { id: 'mod-adsr', label: 'ADSR', family: 'jade' },
  { id: 'mod-dahd', label: 'DAHD', family: 'jade' },
  { id: 'mod-ad1', label: 'AD 1', family: 'jade' },
  { id: 'mod-ad2', label: 'AD 2', family: 'jade' },
  { id: 'mod-ad3', label: 'AD 3', family: 'jade' },
  { id: 'mod-lfo1', label: 'LFO 1', family: 'blue' },
  { id: 'mod-lfo2', label: 'LFO 2', family: 'blue' },
  { id: 'mod-lfo3', label: 'LFO 3', family: 'blue' },
  { id: 'mod-reverb', label: 'Reverb', family: 'blue' },
  { id: 'mod-delay', label: 'Delay', family: 'blue' },
  { id: 'mod-chorus', label: 'Chorus', family: 'blue' },
  { id: 'mod-cheby', label: 'Chebyshev', family: 'blue' },
  { id: 'mod-seq', label: 'Secuenciador', family: 'blue' },
  { id: 'mod-patch', label: 'Matriz', family: 'blue' },
  { id: 'mod-midi', label: 'MIDI', family: 'blue' },
  { id: 'mod-recorder', label: 'Grabadora', family: 'blue' },
  { id: KEYBOARD_SECTION_ID, label: 'Teclado', family: 'neutral' },
];
