import Encoder from "./encoder";

const inlineProcessor = `
class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.bufferSize = 1152;
      this.buffer = new Float32Array(this.bufferSize);
      this.bytesWritten = 0;
      this.bytesWritten = 0;
      this.port.onmessage = (e) => {
        const data = e.data;
        switch (data.action) {
          case "stop":
            this._flush();
            break;
        }
      };
    }
    process(inputs) {
      const samples = inputs[0][0];
      if (!samples)
        return true;
      for (let i = 0; i < samples.length; i++) {
        this.buffer[this.bytesWritten++] = samples[i];
        if (this.bytesWritten >= this.bufferSize) {
          this._flush();
        }
      }
      return true;
    }
    _flush() {
      const buffer = this.bytesWritten < this.bufferSize ? this.buffer.slice(0, this.bytesWritten) : this.buffer;
      if (buffer.length) {
        this.port.postMessage({
          action: "encode",
          buffer
        });
      }
      this.bytesWritten = 0;
    }
  };
  registerProcessor("recorder.processor", RecorderProcessor);
`;

class MicRecorder {
  constructor(config) {
    this.config = {
      // 128 or 160 kbit/s – mid-range bitrate quality
      bitRate: 128,

      // There is a known issue with some macOS machines, where the recording
      // will sometimes have a loud 'pop' or 'pop-click' sound. This flag
      // prevents getting audio from the microphone a few milliseconds after
      // the begining of the recording. It also helps to remove the mouse
      // "click" sound from the output mp3 file.
      startRecordingAt: 300,
      deviceId: null,
    };

    this.activeStream = null;
    this.context = null;
    this.microphone = null;
    this.processor = null;
    this.startTime = 0;
    this.workletUrl = URL.createObjectURL(
      new Blob([inlineProcessor], {
        type: "application/javascript;charset=utf8",
      })
    );

    Object.assign(this.config, config);
  }

  createRecorderProcessor() {
    return new Promise((resolve, reject) => {
      try {
        resolve(new AudioWorkletNode(this.context, "recorder.processor"));
      } catch (error) {
        this.context.audioWorklet
          .addModule(this.workletUrl)
          .then(() =>
            resolve(new AudioWorkletNode(this.context, "recorder.processor"))
          )
          .catch((e) => reject(e));
      }
    });
  }
  /**
   * Starts to listen for the microphone sound
   * @param {MediaStream} stream
   */
  addMicrophoneListener(stream) {
    this.activeStream = stream;

    // This prevents the weird noise once you start listening to the microphone
    this.timerToStart = setTimeout(() => {
      delete this.timerToStart;
    }, this.config.startRecordingAt);

    // Set up Web Audio API to process data from the media stream (microphone).
    this.microphone = this.context.createMediaStreamSource(stream);

    return new Promise((resolve, reject) => {
      this.createRecorderProcessor()
        .then((processor) => {
          this.processor = processor;
          this.processor.port.onmessage = (event) => {
            if (event.data.action === "encode") {
              if (this.timerToStart) {
                return;
              }

              // Send microphone data to LAME for MP3 encoding while recording.
              this.lameEncoder.encode(event.data.buffer);
            }
          };

          // Begin retrieving microphone data.
          this.microphone.connect(this.processor);
          this.processor.connect(this.context.destination);

          resolve();
        })
        .catch((e) => reject(e));
    });
  }

  /**
   * Disconnect microphone, processor and remove activeStream
   */
  stop() {
    if (this.processor && this.microphone) {
      // Clean up the Web Audio API resources.
      this.processor.port.postMessage({ action: "stop" });
      this.microphone.disconnect();
      this.processor.disconnect();

      // If all references using this.context are destroyed, context is closed
      // automatically. DOMException is fired when trying to close again
      if (this.context && this.context.state !== "closed") {
        this.context.close();
      }

      this.processor.onaudioprocess = null;

      // Stop all audio tracks. Also, removes recording icon from chrome tab
      this.activeStream.getAudioTracks().forEach((track) => track.stop());
    }

    return this;
  }

  /**
   * Requests access to the microphone and start recording
   * @return Promise
   */
  start() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.config.sampleRate = this.context.sampleRate;
    this.lameEncoder = new Encoder(this.config);

    const audio = this.config.deviceId
      ? { deviceId: { exact: this.config.deviceId } }
      : true;

    return new Promise((resolve, reject) => {
      navigator.mediaDevices
        .getUserMedia({ audio })
        .then((stream) => this.addMicrophoneListener(stream))
        .then(() => resolve())
        .catch(function (err) {
          reject(err);
        });
    });
  }

  /**
   * Return Mp3 Buffer and Blob with type mp3
   * @return {Promise}
   */
  getMp3() {
    const finalBuffer = this.lameEncoder.finish();

    return new Promise((resolve, reject) => {
      if (finalBuffer.length === 0) {
        reject(new Error("No buffer to send"));
      } else {
        resolve([finalBuffer, new Blob(finalBuffer, { type: "audio/mp3" })]);
        this.lameEncoder.clearBuffer();
      }
    });
  }
}

export default MicRecorder;
