// Eseguire dopo npm run build: prova il PEM effettivo nei bundle server.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {X509Certificate}=require('node:crypto')
const root=path.resolve(__dirname,'../../..')
const expected='80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA'

test('TLS: CA attesa inclusa nei cinque bundle API server, assente dai chunk browser',()=>{
  for(const route of ['accesso','stato','salva','varianti','strutturato']) {
    const code=fs.readFileSync(path.join(root,'.next/server/app/api/rapportino',route,'route.js'),'utf8')
    const pem=code.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/)
    assert(pem,`CA assente dal bundle server ${route}`)
    const normalized=pem[0].replace(/\\n/g,'\n').replace(/\\r/g,'\r')
    assert.equal(new X509Certificate(normalized).fingerprint256,expected)
    assert.match(code,/ssl:\{ca:/)
    assert.match(code,/rejectUnauthorized:!0/)
  }
  function checkBrowser(dir) {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name)
      if(entry.isDirectory()) checkBrowser(file)
      else if(entry.name.endsWith('.js')) {
        assert(!fs.readFileSync(file,'utf8').includes('MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPY'), 'CA nei chunk browser')
      }
    }
  }
  checkBrowser(path.join(root,'.next/static'))
})
