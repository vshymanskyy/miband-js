import builtins from 'rollup-plugin-node-builtins'
import globals from 'rollup-plugin-node-globals'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { eslint } from 'rollup-plugin-eslint'
import uglify from 'rollup-plugin-uglify'
import filesize from 'rollup-plugin-filesize'
import json from 'rollup-plugin-json'
import less from 'rollup-plugin-less'
import sourcemaps from 'rollup-plugin-sourcemaps'

let uglify_opts = {
  compress: {
    passes: 2,
    //hoist_funs: true,
    //hoist_vars: true,
    //toplevel: true,
  },
}

if (process.env.NODE_ENV === 'production') {
  uglify_opts.mangle = {
    toplevel: true,
    /*properties: {
      reserved: ['on', 'catch', 'next', 'reslove', 'reject']
    },*/
  }
} else {
  uglify_opts.compress.drop_debugger = false;
  uglify_opts.output = {
    beautify: true,
  }
}

export default {
  input: 'src/webapp.js',
  output: {
    file:   'public/webapp.bundle.js',
    format: 'iife',
    name:   'MiBand'
  },
  sourceMap: true,
  plugins: [
    eslint({
      throwOnError: true,
      exclude: [ './node_modules/**', './src/styles/**' ]
    }),
    resolve({
      jsnext: true,
      main: true,
      browser: true,
    }),
    json(),
    commonjs(),
    globals(),
    builtins(),
    //uglify(uglify_opts),
    filesize(),
    less({
      insert: true
    }),
    sourcemaps()
  ]
}
