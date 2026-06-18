// Índice de módulos del sinte para el menú de salto del nav inferior. El ORDEN debe coincidir
// con el orden de render de los .module en BasicSynth (las anclas se asignan por índice).
// Los primeros (sin 'mod-keyboard') mapean a `.synth-modules .module`; el último al `.keyboard`.
export interface ModuleSection {
  id: string;
  label: string;
}

export const MODULE_SECTIONS: ModuleSection[] = [
  { id: 'mod-vco1', label: 'VCO 1' },
  { id: 'mod-vco2', label: 'VCO 2' },
  { id: 'mod-vco3', label: 'VCO 3' },
  { id: 'mod-vcf', label: 'VCF' },
  { id: 'mod-vcf2', label: 'VCF 2' },
  { id: 'mod-noise', label: 'Ruido' },
  { id: 'mod-mixer', label: 'Mixer' },
  { id: 'mod-adsr', label: 'ADSR' },
  { id: 'mod-ad1', label: 'AD 1' },
  { id: 'mod-ad2', label: 'AD 2' },
  { id: 'mod-dahd', label: 'DAHD' },
  { id: 'mod-lfo1', label: 'LFO 1' },
  { id: 'mod-lfo2', label: 'LFO 2' },
  { id: 'mod-reverb', label: 'Reverb' },
  { id: 'mod-delay', label: 'Delay' },
  { id: 'mod-patch', label: 'Matriz' },
  { id: 'mod-midi', label: 'MIDI' },
  { id: 'mod-seq', label: 'Secuenciador' },
  { id: 'mod-drums', label: 'Batería' },
  { id: 'mod-keyboard', label: 'Teclado' },
];

// Id de la última sección (el teclado vive fuera de .synth-modules).
export const KEYBOARD_SECTION_ID = 'mod-keyboard';
