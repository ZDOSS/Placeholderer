#!/usr/bin/env node
import { Command } from 'commander';
import { validateManifest } from '@placeholderer/core';

const program = new Command();

program
  .name('placeholderer')
  .description('Placeholderer CLI')
  .version('0.1.0');

program
  .command('validate')
  .description('Validate a manifest file')
  .argument('<file>', 'path to manifest')
  .action((file) => {
    console.log('validate command not fully implemented yet');
  });

program.parse();