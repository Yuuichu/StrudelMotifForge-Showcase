import type { MutationOperator, GeneratedPattern, StyleContextBundle } from '../../types'
import type { MutationInput } from '../../ai/provider'
import { getAIProvider } from '../../ai/config'
import { parseLayers } from '../layer-lock/parser'
import { validatePattern } from '../pattern-validator/validator'

/**
 * Apply a mutation operator to specific layers while preserving locked layers.
 *
 * Flow: parse code → identify locked/target layer code → build MutationInput →
 *       AI.mutateCode → validate → verify lock integrity → return
 */
export async function applyMutation(
  code: string,
  lockedLayerNames: string[],
  targetLayerNames: string[],
  operator: MutationOperator,
  intensity: number,
  instruction?: string,
  context?: StyleContextBundle,
): Promise<GeneratedPattern> {
  const provider = getAIProvider()
  if (!Number.isFinite(intensity)) throw new Error('Mutation intensity must be a finite number')
  const [minimumIntensity, maximumIntensity] = operator.intensityRange
  const normalizedIntensity = Math.round(
    Math.max(minimumIntensity, Math.min(maximumIntensity, intensity)),
  ) as 1 | 2 | 3 | 4 | 5
  const layers = parseLayers(code)
  const availableNames = new Set(layers.map((layer) => layer.name))
  const unknownTargets = targetLayerNames.filter((name) => !availableNames.has(name))
  const unknownLocks = lockedLayerNames.filter((name) => !availableNames.has(name))
  if (targetLayerNames.length === 0) {
    throw new Error('Select at least one layer to mutate')
  }
  if (unknownTargets.length > 0) {
    throw new Error(`Unknown target layer(s): ${unknownTargets.join(', ')}`)
  }
  if (unknownLocks.length > 0) {
    throw new Error(`Unknown locked layer(s): ${unknownLocks.join(', ')}`)
  }
  const overlap = targetLayerNames.filter((name) => lockedLayerNames.includes(name))
  if (overlap.length > 0) {
    throw new Error(`Locked layers cannot also be mutation targets: ${overlap.join(', ')}`)
  }

  const targetSet = new Set(targetLayerNames)

  // Every non-target layer is protected; explicit locks receive extra prompt emphasis.
  const protectedLayerData = layers
    .filter((layer) => !targetSet.has(layer.name))
    .map((layer) => ({ name: layer.name, code: layer.code }))

  // Extract target layer code (to mutate)
  const targetLayerData = layers
    .filter((l) => targetSet.has(l.name))
    .map((l) => ({ name: l.name, code: l.code }))

  // Build mutation input
  const mutationInput: MutationInput = {
    request: {
      versionId: '',
      targetLayers: targetLayerNames,
      lockedLayers: lockedLayerNames,
      mutationOperator: operator,
      intensity: normalizedIntensity,
      instruction,
    },
    lockedLayerData: protectedLayerData,
    targetLayerData,
    fullCode: code,
  }

  // First attempt
  let result = await provider.mutateCode(mutationInput, context ?? {} as StyleContextBundle)
  let validation = validateMutationResult(
    result.version.code,
    code,
    targetSet,
    protectedLayerData,
  )

  // Retry if validation fails or locks were violated
  if (!validation.valid) {
    console.warn('[Mutation] First attempt had issues, retrying...', validation.errors)
    // Strengthen the instruction to emphasize lock preservation
    mutationInput.request.instruction = [
      instruction ?? '',
      'CRITICAL: The previous attempt modified protected layers. Change target layers only.',
    ].filter(Boolean).join(' | ')

    result = await provider.mutateCode(mutationInput, context ?? {} as StyleContextBundle)
    validation = validateMutationResult(
      result.version.code,
      code,
      targetSet,
      protectedLayerData,
    )
  }

  if (!validation.valid) {
    throw new Error(`Mutation failed validation: ${validation.errors.join('; ')}`)
  }

  return {
    ...result,
    parsedLayers: parseLayers(result.version.code),
    warnings: [
      ...(result.warnings ?? []),
      ...validation.warnings.map((w, index) => ({
        id: `mut-val-${Date.now()}-${index}`,
        severity: 'low' as const,
        target: 'code' as const,
        message: w,
        repairSuggestion: '',
        suggestedOperators: [],
      })),
    ],
  }
}

function validateMutationResult(
  code: string,
  originalCode: string,
  targetNames: Set<string>,
  lockedLayers: { name: string; code: string }[],
): ReturnType<typeof validatePattern> {
  const validation = validatePattern(code)
  const mutatedLayers = parseLayers(code)
  for (const locked of lockedLayers) {
    const mutatedLayer = mutatedLayers.find((layer) => layer.name === locked.name)
    if (!mutatedLayer || mutatedLayer.code !== locked.code) {
      validation.errors.push(`Locked layer "${locked.name}" was modified or removed`)
    }
  }
  if (maskTargetLayerBodies(code, targetNames) !== maskTargetLayerBodies(originalCode, targetNames)) {
    validation.errors.push('Code outside target layer bodies was modified')
  }
  return { ...validation, valid: validation.errors.length === 0 }
}

function maskTargetLayerBodies(code: string, targetNames: Set<string>): string {
  const lines = code.split('\n')
  const targets = parseLayers(code)
    .filter((layer) => targetNames.has(layer.name))
    .sort((a, b) => b.startLine - a.startLine)

  for (const layer of targets) {
    const contentStart = layer.startLine
    const contentLength = Math.max(0, layer.endLine - layer.startLine - 1)
    lines.splice(contentStart, contentLength, '<TARGET_LAYER_BODY>')
  }
  return lines.join('\n')
}
