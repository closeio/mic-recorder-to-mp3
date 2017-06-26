import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

export default {
  entry: 'src/mic-recorder.js',
  plugins: [
    nodeResolve({ jsnext: true, main: true }),
    commonjs({ include: 'node_modules/**' }),
    babel({ exclude: 'node_modules/**' }),
    !!process.env.minify && uglify(),
  ],
  format: 'umd',
  dest: `dist/index${process.env.minify ? '.min' : ''}.js`,
  sourceMap: true,
  moduleName: 'MicRecorder',
  useStrict: false,
}
