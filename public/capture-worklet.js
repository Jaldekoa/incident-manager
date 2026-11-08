class TabAudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.batchSize = 2048;
    this.batch = new Float32Array(this.batchSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const channels = inputs[0] || [];
    const outputChannels = outputs[0] || [];
    if (!channels.length) return true;
    const frames = channels[0].length;

    for (let channel = 0; channel < outputChannels.length; channel++) {
      outputChannels[channel].set(channels[Math.min(channel, channels.length - 1)]);
    }

    for (let frame = 0; frame < frames; frame++) {
      let sample = 0;
      for (let channel = 0; channel < channels.length; channel++) sample += channels[channel][frame] || 0;
      this.batch[this.offset++] = sample / channels.length;
      if (this.offset === this.batchSize) {
        const completeBatch = this.batch;
        this.batch = new Float32Array(this.batchSize);
        this.offset = 0;
        this.port.postMessage(completeBatch, [completeBatch.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('tab-audio-capture', TabAudioCaptureProcessor);
