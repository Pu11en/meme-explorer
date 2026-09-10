#!/usr/bin/env node
import { analyzeMain } from './cli.js'
analyzeMain(process.argv.slice(2)).catch((e) => {
  process.stderr.write(String(e) + '\n')
  process.exitCode = 1
})
