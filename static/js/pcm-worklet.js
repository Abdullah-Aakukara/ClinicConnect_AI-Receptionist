class PCMDownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRateIn = sampleRate; // worklet context sample rate
    this.sampleRateOut = 16000;
    this.decimation = Math.floor(this.sampleRateIn / this.sampleRateOut);
    this.buffer = [];
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    // Downsample by simple decimation and convert to 16-bit PCM
    for (let i = 0; i < channel.length; i += this.decimation) {
      const s = Math.max(-1, Math.min(1, channel[i] || 0));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      this.buffer.push(val);
    }

    // Send in chunks of ~20ms at 16kHz => 320 samples
    const frameSize = 320; // samples
    while (this.buffer.length >= frameSize) {
      const frame = this.buffer.splice(0, frameSize);
      const bytes = new ArrayBuffer(frame.length * 2);
      const view = new DataView(bytes);
      for (let i = 0; i < frame.length; i++) {
        view.setInt16(i * 2, frame[i], true);
      }
      this.port.postMessage(bytes);
    }
    return true;
  }
}

registerProcessor('pcm-downsampler', PCMDownsamplerProcessor);


