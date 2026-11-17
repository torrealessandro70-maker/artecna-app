/* eslint-disable @typescript-eslint/no-require-imports -- Fixture PostgreSQL nativa locale. */
const path=require('node:path'),fs=require('node:fs'),Module=require('node:module')
const file=path.join(__dirname,'contratto-acconti-sdi.test.cjs')
const source=fs.readFileSync(file,'utf8')
const anchor="  const browser=require('./browser/attesi-page-browser.cjs')"
if(!source.includes(anchor))throw Error('Fixture hook missing')
const fixture=new Module(file,module)
fixture.filename=file
fixture.paths=Module._nodeModulePaths(__dirname)
fixture._compile(source.replace(anchor, () => "  await require('./ribassoContrattualeFixture.cjs')({ q, value, as, load, admin, fixture, titolare, esterno, client2, randomUUID, assert, lordoDoc, leggi })\n  return\n" + anchor), file)
