# Microphone Recorder to Mp3

Record your microphone audio input and get an ```audio/mp3``` ouput buffer/blob.

# Development
```bash
yarn
```

# Build

```bash
npm run build
```

**Note:** Build uses babel to transpile ES6 to old browsers.

# How to use

```js
// New instance
const recorder = return new MicRecorder({
  bitRate: 128
});

// Start recording. Browser will request permission to use your microphone.
recorder.start(function () {
  console.log('Start voicemail recording');
}, function () {
  alert('We could not make use of your microphone at the moment');
});


// Once you are done singing your best song, stop and get the mp3.
this.recorder
  .stop()
  .getMp3((buffer, blob) =>
    // do what ever you want with buffer and blob
    // Example: Create a mp3 file and play
    const file = new File(buffer, 'me-at-thevoice.mp3', {
      type: blob.type, lastModified: Date.now()
    });

    const player = new Audio(URL.createObjectURL(file));

    player.play();

  }), function (e) {
    alert('We could not retrieve your message');
    console.log(e);
  });
```