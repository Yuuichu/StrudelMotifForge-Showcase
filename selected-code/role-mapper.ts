/**
 * Layer 1: Role Mapper — maps CompositionLayer roles to pattern templates
 * based on StyleProfile parameters (BPM, grooveLogic, timbreLogic).
 */
import type { CompositionLayer, StyleCreativeLibrary } from '../../types'

export type RolePattern = {
  rhythm: string       // mini-notation pattern string
  sound: string        // sample/oscillator name
  effects: string[]    // effect chain strings
}

const ROLE_TEMPLATES: Record<string, Record<string, RolePattern>> = {
  drums: {
    four_on_floor:   { rhythm: 'bd*4', sound: 'bd', effects: ['.gain(0.85)', '.room(0.15)'] },
    sparse:          { rhythm: 'bd(3,8)', sound: 'bd', effects: ['.gain(0.7)', '.room(0.2)'] },
    breakbeat:       { rhythm: 'bd(3,8), [~ sd]*2, hh*8', sound: 'break:1', effects: ['.gain(0.7)', '.room(0.1)'] },
    syncopated:      { rhythm: 'bd ~ bd ~ ~ bd ~ bd ~', sound: 'bd', effects: ['.gain(0.8)', '.room(0.15)'] },
    industrial:      { rhythm: 'bd(5,8)', sound: 'metal:1', effects: ['.gain(0.7)', '.room(0.3)'] },
  },
  bass: {
    sidechain:       { rhythm: 'd1 ~ ~ f1 ~ d1 ~ ~', sound: 'sawtooth', effects: ['.lpf(400)', '.gain(0.55)'] },
    sub:             { rhythm: 'd1 ~ ~ ~ ~ ~ ~ ~', sound: 'sine', effects: ['.lpf(80)', '.gain(0.6)'] },
    walking:         { rhythm: 'd1 ~ f1 ~ a1 ~ c2 ~', sound: 'sawtooth', effects: ['.lpf(300)', '.gain(0.5)'] },
    pulse:           { rhythm: 'd1 ~ ~ d1 ~ d1 ~ f1', sound: 'sawtooth', effects: ['.lpf(200)', '.gain(0.5)', '.decay(0.3)'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
  texture: {
    noise_drift:     { rhythm: 'noise*3', sound: 'noise', effects: ['.lpf(600)', '.gain(0.15)', '.room(0.8)', '.slow(8)'] },
    drone:           { rhythm: 'd2 a2', sound: 'sine', effects: ['.lpf(400)', '.gain(0.12)', '.room(0.85)', '.slow(16)'] },
    shimmer:         { rhythm: 'noise', sound: 'noise', effects: ['.lpf(4000)', '.hpf(2000)', '.gain(0.08)', '.room(0.9)'] },
    pad:             { rhythm: 'd3 f3 a3', sound: 'sawtooth', effects: ['.lpf(500)', '.gain(0.1)', '.room(0.85)'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
  lead: {
    arp:             { rhythm: '0 2 4 7 4 2', sound: 'sawtooth', effects: ['.lpf(1000)', '.gain(0.4)'] },
    stab:            { rhythm: 'd4 ~ ~ ~ f4 ~ ~ ~', sound: 'sawtooth', effects: ['.lpf(800)', '.gain(0.35)', '.decay(0.2)'] },
    melody:          { rhythm: 'c4 ~ ~ ~ e4 ~ g4 ~', sound: 'sawtooth', effects: ['.lpf(1200)', '.gain(0.4)'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
  fx: {
    metallic:        { rhythm: 'metal:1', sound: 'metal:1', effects: ['.gain(0.25)', '.room(0.9)', '.delay(0.5)', '.sometimesBy(0.3, fast(2))'] },
    noise_burst:     { rhythm: 'noise', sound: 'noise', effects: ['.gain(0.1)', '.lpf(2000)', '.sometimesBy(0.2, gain(0.3))'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
  space: {
    reverb_drone:    { rhythm: 'noise*2', sound: 'noise', effects: ['.lpf(300)', '.gain(0.05)', '.room(0.95)', '.slow(24)'] },
    ping:            { rhythm: 'metal:3', sound: 'metal:3', effects: ['.gain(0.08)', '.room(0.95)', '.delay(0.8)', '.sometimesBy(0.08, gain(0.2))'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
  hook: {
    pattern:         { rhythm: 'c5 ~ e5 ~ g5 ~ a5 ~', sound: 'sine', effects: ['.lpf(2000)', '.gain(0.4)', '.room(0.5)'] },
    none:            { rhythm: '', sound: 'silence', effects: [] },
  },
}

/** Pick the best pattern template for a layer based on its role and the style profile. */
export function mapRoleToPattern(
  layer: CompositionLayer,
  style: StyleCreativeLibrary,
): RolePattern {
  const role = layer.role ?? 'texture'
  const templates = ROLE_TEMPLATES[role]
  if (!templates) return { rhythm: '', sound: 'silence', effects: [] }

  // Determine the best sub-pattern from the style's character
  const grooveLogic = style.styleDNA?.grooveLogic?.join(' ').toLowerCase() ?? ''
  const timbreLogic = style.styleDNA?.timbreLogic?.join(' ').toLowerCase() ?? ''
  const bpm = style.defaultTempo ?? 120

  switch (role) {
    case 'drums':
      if (bpm > 150) return templates.breakbeat
      if (grooveLogic.includes('four') || grooveLogic.includes('steady')) return templates.four_on_floor
      if (grooveLogic.includes('sparse') || grooveLogic.includes('irregular')) return templates.sparse
      if (grooveLogic.includes('syncopat')) return templates.syncopated
      if (grooveLogic.includes('industrial') || grooveLogic.includes('mechanical')) return templates.industrial
      return templates.four_on_floor

    case 'bass':
      if (bpm > 150) return templates.sub
      if (timbreLogic.includes('sub') || grooveLogic.includes('weight')) return templates.sub
      if (layer.rhythmIdea?.includes('syncopat')) return templates.pulse
      return templates.sidechain

    case 'texture':
      if (grooveLogic.includes('drone') || grooveLogic.includes('ambient')) return templates.drone
      if (grooveLogic.includes('shimmer') || timbreLogic.includes('bright')) return templates.shimmer
      if (timbreLogic.includes('pad')) return templates.pad
      return templates.noise_drift

    case 'lead':
      if (grooveLogic.includes('arp')) return templates.arp
      if (bpm > 140) return templates.stab
      return templates.arp

    case 'fx':
      if (timbreLogic.includes('metal') || grooveLogic.includes('industrial')) return templates.metallic
      return templates.noise_burst

    case 'space':
      if (bpm < 100) return templates.reverb_drone
      return templates.ping

    case 'hook':
      return templates.pattern

    default:
      return { rhythm: '', sound: 'silence', effects: [] }
  }
}
