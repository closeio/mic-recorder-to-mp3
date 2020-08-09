import Encoder from './encoder';

class MicRecorder {
  constructor(config) {
    this.config = {
      // 128 or 160 kbit/s – mid-range bitrate quality
      bitRate: 128,

      deviceId: null,
      // Encode to mp3 after finish recording
      // Encoding during recording may result in distorted audio
      // This could be crucial on mobile devices
      encodeAfterRecord: true,
      // There is a known issue with some macOS machines, where the recording
      // will sometimes have a loud 'pop' or 'pop-click' sound. This flag
      // prevents getting audio from the microphone a few milliseconds after
      // the beginning of the recording. It also helps to remove the mouse
      // "click" sound from the output mp3 file.
      startRecordingAt: 300,
    };

    this.activeStream = null;
    this.context = null;
    this.microphone = null;
    this.processor = null;
    this.startTime = 0;
    this.rawChunksBuffer = null;

    Object.assign(this.config, config);
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

    // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
    this.processor = this.context.createScriptProcessor(0, 1, 1);

    // Add all buffers from LAME into an array.
    this.processor.onaudioprocess = (event) => {
      if (this.timerToStart) {
        return;
      }

      const rawChunk = event.inputBuffer.getChannelData(0);

      if (this.config.encodeAfterRecord) {
        // Save copy of raw chunk for future encoding
        this.rawChunksBuffer.push( Object.assign([], rawChunk));
      } else {
        // Send microphone data to LAME for MP3 encoding while recording.
        this.lameEncoder.encode(rawChunk);
      }
    };

    this.connectMicrophone();
  };

  /**
   * Requests access to the microphone and starts recording
   * @return Promise
   */
  initialize() {
    const { deviceId, encodeAfterRecord } = this.config;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();
    this.config.sampleRate = this.context.sampleRate;
    this.rawChunksBuffer = encodeAfterRecord ? [] : null;
    this.lameEncoder = new Encoder(this.config);
    this.i = 0;

    const audio = deviceId ? { deviceId: { exact: deviceId } } : true;

    return new Promise((resolve, reject) => {
      navigator.mediaDevices.getUserMedia({ audio })
        .then(stream => {
          this.addMicrophoneListener(stream);
          resolve(stream);
        }).catch(function(err) {
        reject(err);
      });
    })
  };

  /**
   * Initializes or resumes recording
   * @return Promise
   */
  start() {
    if (!this.processor || !this.microphone) {
      return this.initialize();
    } else {
      this.connectMicrophone();
      return Promise.resolve();
    }
  }

  /**
   * Pause recording
   * @return Promise
   */
  pause() {
    this.disconnectMicrophone();
    return Promise.resolve();
  };

  /**
   * Start retrieving microphone data
   */
  connectMicrophone() {
    if (this.processor && this.microphone) {
      this.microphone.connect(this.processor);
      this.processor.connect(this.context.destination);
    }
  }

  /**
   * Stop retrieving microphone data
   */
  disconnectMicrophone() {
    if (this.processor && this.microphone) {
      this.microphone.disconnect();
      this.processor.disconnect();
    }
  }

  /**
   * Disconnect microphone, processor and remove activeStream
   * @return MicRecorder
   */
  stop() {
    if (this.processor && this.microphone) {
      // Clean up the Web Audio API resources.
      this.disconnectMicrophone();

      // If all references using this.context are destroyed, context is closed
      // automatically. DOMException is fired when trying to close again
      if (this.context && this.context.state !== 'closed') {
        this.context.close();
      }

      this.processor.onaudioprocess = null;

      // Stop all audio tracks. Also, removes recording icon from chrome tab
      this.activeStream.getAudioTracks().forEach(track => track.stop());
      this.processor = null;
      this.microphone = null;
    }

    return this;
  };

  /**
   * Encodes raw audio chunks into mp3
   * @return Promise
   */
  encodeRawChunks() {
    return this.rawChunksBuffer.reduce((previousOperation, rawChunk) => {
      return previousOperation.then(() => {
        return new Promise((resolve) => {
          //this improve browser responsiveness during encoding process
          setTimeout(() => {
            this.lameEncoder.encode(rawChunk);
            resolve();
          });
        });
      });
    }, Promise.resolve());
  }

  /**
   * Finishes encoding process and returns prepared mp3 file as a result
   * @return Promise
   */
  finishEncoding() {
    const finalBuffer = this.lameEncoder.finish();
    this.rawChunksBuffer = null;

    return new Promise((resolve, reject) => {
      if (finalBuffer.length === 0) {
        reject(new Error('No buffer to send'));
      } else {
        resolve([finalBuffer, new Blob(finalBuffer, { type: 'audio/mp3' })]);
        this.lameEncoder.clearBuffer();
      }
    });
  }

  /**
   * Return Mp3 Buffer and Blob with type mp3
   * @return Promise
   */
  getMp3() {
    return (
      this.config.encodeAfterRecord
        ? this.encodeRawChunks()
        : Promise.resolve()
    ).then(() => this.finishEncoding());
  }
}

export default MicRecorder;
