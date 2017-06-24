const rollup = require('rollup');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');

rollup
  .rollup({
    entry: 'src/mic-recorder.js',
    plugins: [
      nodeResolve({ jsnext: true, main: true }),
      commonjs({ include: 'node_modules/**' }),
      babel({ exclude: 'node_modules/**' }),
    ],
  })
  .then(bundle => bundle.write({
    format: 'umd',
    dest: 'dist/index.js',
    sourceMap: true,
    moduleName: 'MicRecorder',
    useStrict: false,
  }))
  .catch(console.error.bind(console));
  