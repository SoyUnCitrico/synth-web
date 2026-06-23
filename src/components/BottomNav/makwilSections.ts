import { type ModuleSection, KEYBOARD_SECTION_ID } from './sections';

export { KEYBOARD_SECTION_ID } from './sections';
export type { ModuleSection } from './sections';

// Índice de módulos de MAKWIL para el menú del nav inferior. El ORDEN debe coincidir con el
// orden de render de los .module en Makwil.tsx (sin batería). El último (teclado) vive fuera
// del grid.
export const MAKWIL_MODULE_SECTIONS: ModuleSection[] = [
  { id: 'mod-vco1', label: 'VCO 1' },
  { id: 'mod-vco2', label: 'VCO 2' },
  { id: 'mod-vco3', label: 'VCO 3' },
  { id: 'mod-vco4', label: 'VCO 4' },
  { id: 'mod-vcf', label: 'VCF' },
  { id: 'mod-vcf2', label: 'VCF 2' },
  { id: 'mod-vcf3', label: 'VCF 3' },
  { id: 'mod-noise', label: 'Ruido' },
  { id: 'mod-mixer', label: 'Mixer' },
  { id: 'mod-adsr', label: 'ADSR' },
  { id: 'mod-ad1', label: 'AD 1' },
  { id: 'mod-ad2', label: 'AD 2' },
  { id: 'mod-ad3', label: 'AD 3' },
  { id: 'mod-dahd', label: 'DAHD' },
  { id: 'mod-lfo1', label: 'LFO 1' },
  { id: 'mod-lfo2', label: 'LFO 2' },
  { id: 'mod-lfo3', label: 'LFO 3' },
  { id: 'mod-reverb', label: 'Reverb' },
  { id: 'mod-delay', label: 'Delay' },
  { id: 'mod-chorus', label: 'Chorus' },
  { id: 'mod-cheby', label: 'Chebyshev' },
  { id: 'mod-seq', label: 'Secuenciador' },
  { id: 'mod-patch', label: 'Matriz' },
  { id: 'mod-midi', label: 'MIDI' },
  { id: KEYBOARD_SECTION_ID, label: 'Teclado' },
];
