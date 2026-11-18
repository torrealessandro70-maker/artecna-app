/* eslint-disable @typescript-eslint/no-require-imports -- Regressioni sul nuovo schema, solo loopback. */
const path=require('node:path'),fs=require('node:fs'),Module=require('node:module')
const file=path.join(__dirname,'contratto-acconti-sdi.test.cjs'),childFile=path.join(__dirname,'ribassoContrattualeFixture.cjs')
const source=fs.readFileSync(file,'utf8'),anchor="  const browser=require('./browser/attesi-page-browser.cjs')"
const child=fs.readFileSync(childFile,'utf8'),install="    // Verificare le guardie anche quando le policy non proteggono le righe."
if(!source.includes(anchor)||!child.includes(install))throw Error('Fixture hook missing')
const patched=new Module(childFile,module);patched.filename=childFile;patched.paths=Module._nodeModulePaths(__dirname)
patched._compile(child.replace(install,()=>"    await q(load('20261118000100_addebiti_materiali_cliente.sql'))\n"+install),childFile)
const fixture=new Module(file,module);fixture.filename=file;fixture.paths=Module._nodeModulePaths(__dirname)
fixture.require=name=>name==='./addebiti-ribasso-fixture'?patched.exports:module.require(name)
fixture._compile(source.replace(anchor,()=>"  await require('./addebiti-ribasso-fixture')({q,value,as,load,admin,fixture,titolare,esterno,client2,randomUUID,assert,lordoDoc,leggi})\n  return\n"+anchor),file)
