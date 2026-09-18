import type { RuntimeError } from '../../types'
import type { StrudelRuntime } from './adapter'
import {
  STRUDEL_RUNTIME_PROTOCOL,
  isRuntimeEvent,
  type RuntimeCommand,
  type RuntimeCommandType,
  type RuntimeEvent,
  type RuntimeState,
} from './protocol'
import { assertSafeStrudelCode } from './safety'

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15_000
const DEFAULT_COMMAND_TIMEOUT_MS = 15_000
const USER_GESTURE_TIMEOUT_MS = 120_000

type PendingRequest = {
  command: RuntimeCommandType
  resolve: () => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export type IframeRuntimeOptions = {
  frameUrl?: string
  handshakeTimeoutMs?: number
  commandTimeoutMs?: number
}

/** Parent-side adapter. All Strudel evaluation happens in an opaque-origin sandbox iframe. */
export class IframeStrudelRuntime implements StrudelRuntime {
  private readonly frameUrl: string
  private readonly handshakeTimeoutMs: number
  private readonly commandTimeoutMs: number
  private iframe: HTMLIFrameElement | null = null
  private port: MessagePort | null = null
  private connectPromise: Promise<void> | null = null
  private initPromise: Promise<void> | null = null
  private pending = new Map<string, PendingRequest>()
  private errorCallbacks = new Set<(error: RuntimeError) => void>()
  private stateCallbacks = new Set<(state: RuntimeState) => void>()
  private state: RuntimeState = 'booting'
  private requestSequence = 0
  private generation = 0
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null
  private desiredBpm: number | null = null

  constructor(options: IframeRuntimeOptions = {}) {
    this.frameUrl = options.frameUrl ?? `${import.meta.env.BASE_URL}strudel-runtime.html`
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS
    this.commandTimeoutMs = options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS
  }

  async initAudio(): Promise<void> {
    if (this.initPromise) return this.initPromise
    this.initPromise = this.sendCommand('INIT').then(async () => {
      if (this.desiredBpm !== null) await this.sendCommand('SET_BPM', { bpm: this.desiredBpm })
    }).catch((error) => {
      this.initPromise = null
      throw error
    })
    return this.initPromise
  }

  async play(code: string): Promise<void> {
    assertSafeStrudelCode(code)
    await this.initAudio()
    await this.sendCommand('PLAY', { code })
  }

  async stop(): Promise<void> {
    if (!this.iframe) {
      this.setState('idle')
      return
    }
    await this.sendCommand('STOP')
  }

  setBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) return
    this.desiredBpm = bpm
    if (!this.iframe || !this.initPromise) return
    void this.sendCommand('SET_BPM', { bpm }).catch((error) => {
      this.reportError(error.message, 'SET_BPM_FAILED')
    })
  }

  isPlaying(): boolean {
    return this.state === 'playing'
  }

  onError(callback: (error: RuntimeError) => void): () => void {
    this.errorCallbacks.add(callback)
    return () => this.errorCallbacks.delete(callback)
  }

  onStateChange(callback: (state: RuntimeState) => void): () => void {
    this.stateCallbacks.add(callback)
    callback(this.state)
    return () => this.stateCallbacks.delete(callback)
  }

  async dispose(): Promise<void> {
    if (this.port) {
      try { await this.sendCommand('DISPOSE') } catch { /* frame may already be unavailable */ }
    }
    this.destroyFrame(new Error('Strudel runtime disposed'))
    this.setState('disposed')
  }

  private async sendCommand(
    type: RuntimeCommandType,
    payload: { code?: string; bpm?: number } = {},
  ): Promise<void> {
    await this.ensureConnected()
    if (!this.port) throw new Error('Strudel sandbox is not connected')

    const requestId = `runtime-${Date.now()}-${++this.requestSequence}`
    const command = makeCommand(type, requestId, payload)
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = makeRuntimeError(`Strudel sandbox ${type} timed out`, 'COMMAND_TIMEOUT')
        this.pending.delete(requestId)
        this.destroyFrame(error)
        reject(error)
      }, this.commandTimeoutMs)
      this.pending.set(requestId, { command: type, resolve, reject, timer })
      this.port!.postMessage(command)
    })
  }

  private ensureConnected(): Promise<void> {
    if (this.port && this.connectPromise) return this.connectPromise
    if (this.connectPromise) return this.connectPromise

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const generation = ++this.generation
      const iframe = document.createElement('iframe')
      iframe.src = this.frameUrl
      iframe.title = 'Strudel audio runtime'
      iframe.setAttribute('sandbox', 'allow-scripts')
      iframe.setAttribute('allow', 'autoplay')
      setFrameVisibility(iframe, false)

      this.clearHandshakeTimer()
      this.handshakeTimer = setTimeout(() => {
        if (generation !== this.generation || this.iframe !== iframe) return
        const error = new Error('Strudel sandbox handshake timed out')
        this.destroyFrame(error)
        reject(error)
      }, this.handshakeTimeoutMs)

      iframe.addEventListener('load', () => {
        if (generation !== this.generation || this.iframe !== iframe || !iframe.contentWindow) return
        const channel = new MessageChannel()
        this.port = channel.port1
        channel.port1.onmessage = (event: MessageEvent<unknown>) => {
          if (generation !== this.generation || !isRuntimeEvent(event.data)) return
          if (event.data.type === 'READY') {
            this.clearHandshakeTimer()
            channel.port1.start()
            resolve()
            return
          }
          this.handleRuntimeEvent(event.data)
        }
        channel.port1.start()
        iframe.contentWindow.postMessage(
          { protocol: STRUDEL_RUNTIME_PROTOCOL, type: 'CONNECT' },
          '*',
          [channel.port2],
        )
      }, { once: true })
      iframe.addEventListener('error', () => {
        if (generation !== this.generation || this.iframe !== iframe) return
        this.clearHandshakeTimer()
        const error = new Error('Failed to load Strudel sandbox')
        this.destroyFrame(error)
        reject(error)
      }, { once: true })

      this.iframe = iframe
      document.body.append(iframe)
    }).catch((error) => {
      this.connectPromise = null
      throw error
    })
    return this.connectPromise
  }

  private handleRuntimeEvent(event: RuntimeEvent): void {
    if (event.type === 'STATE') {
      this.setState(event.state)
      if (this.iframe) setFrameVisibility(this.iframe, event.state === 'awaiting-user-gesture')
      if (event.state === 'awaiting-user-gesture' && event.requestId) {
        this.extendRequestTimeout(event.requestId, USER_GESTURE_TIMEOUT_MS)
      }
      return
    }
    if (event.type === 'ERROR') {
      const runtimeError: RuntimeError = {
        message: event.message,
        code: event.code,
        line: event.line,
        column: event.column,
      }
      for (const callback of this.errorCallbacks) callback(runtimeError)
      if (event.requestId) this.settleRequest(event.requestId, makeRuntimeError(event.message, event.code))
      if (!event.recoverable) this.destroyFrame(new Error(event.message))
      return
    }
    if (event.type === 'ACK') {
      const request = this.pending.get(event.requestId)
      if (!request || request.command !== event.command) return
      this.settleRequest(event.requestId)
    }
  }

  private settleRequest(requestId: string, error?: Error): void {
    const request = this.pending.get(requestId)
    if (!request) return
    clearTimeout(request.timer)
    this.pending.delete(requestId)
    if (error) request.reject(error)
    else request.resolve()
  }

  private destroyFrame(reason: Error): void {
    ++this.generation
    this.clearHandshakeTimer()
    for (const request of this.pending.values()) {
      clearTimeout(request.timer)
      request.reject(reason)
    }
    this.pending.clear()
    this.port?.close()
    this.port = null
    this.iframe?.remove()
    this.iframe = null
    this.connectPromise = null
    this.initPromise = null
    if (this.state !== 'disposed') this.setState('booting')
  }

  private reportError(message: string, code: string): void {
    for (const callback of this.errorCallbacks) callback({ message, code })
  }

  private setState(state: RuntimeState): void {
    if (this.state === state) return
    this.state = state
    for (const callback of this.stateCallbacks) callback(state)
  }

  private extendRequestTimeout(requestId: string, timeoutMs: number): void {
    const request = this.pending.get(requestId)
    if (!request) return
    clearTimeout(request.timer)
    request.timer = setTimeout(() => {
      const error = makeRuntimeError('Strudel sandbox user gesture timed out', 'USER_GESTURE_TIMEOUT')
      this.pending.delete(requestId)
      this.destroyFrame(error)
      request.reject(error)
    }, timeoutMs)
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer === null) return
    clearTimeout(this.handshakeTimer)
    this.handshakeTimer = null
  }
}

function makeRuntimeError(message: string, code = 'RUNTIME_ERROR'): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

function makeCommand(
  type: RuntimeCommandType,
  requestId: string,
  payload: { code?: string; bpm?: number },
): RuntimeCommand {
  const base = { protocol: STRUDEL_RUNTIME_PROTOCOL, requestId }
  switch (type) {
    case 'PLAY': return { ...base, type, code: payload.code ?? '' }
    case 'SET_BPM': return { ...base, type, bpm: payload.bpm ?? 0 }
    case 'INIT': return { ...base, type }
    case 'STOP': return { ...base, type }
    case 'DISPOSE': return { ...base, type }
  }
}

function setFrameVisibility(iframe: HTMLIFrameElement, visible: boolean): void {
  Object.assign(iframe.style, visible
    ? {
        position: 'fixed', right: '16px', bottom: '16px', width: '280px', height: '112px',
        border: '1px solid #555', borderRadius: '6px', zIndex: '2147483647', opacity: '1',
        pointerEvents: 'auto', background: '#151515',
      }
    : {
        position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0',
        zIndex: '-1', opacity: '0', pointerEvents: 'none', background: 'transparent',
      })
}
