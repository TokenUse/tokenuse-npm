#!/usr/bin/env node
import{spawn}from'child_process';import{existsSync}from'fs';import{join,dirname}from'path';import{fileURLToPath}from'url';
const d=dirname(fileURLToPath(import.meta.url)),b=join(d,'../.tokenuse/bin/tokenuse');
if(!existsSync(b)){console.error('TokenUse binary not found. Reinstall: npm i -g tokenuse');process.exit(1);}
spawn(b,process.argv.slice(2),{stdio:'inherit',env:process.env}).on('error',e=>{console.error('Failed: '+e.message);process.exit(1);}).on('exit',c=>process.exit(c??0));
