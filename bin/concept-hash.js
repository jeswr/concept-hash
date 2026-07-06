#!/usr/bin/env node
// AUTHORED-BY Claude Fable 5
import { main } from '../dist/cli.js';

process.exitCode = await main(process.argv.slice(2));
