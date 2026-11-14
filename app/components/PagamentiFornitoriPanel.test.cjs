/* eslint-disable @typescript-eslint/no-require-imports -- Local UI harness. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync(require('node:path').join(__dirname,'PagamentiFornitoriPanel.tsx'),'utf8')
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText

test('Vista Fornitori: lettura per fattura, apertura e verifica esplicita con gestione conflitto', async () => {
  const calls=[], state=[], effects=[]
  let index=0
  const debt={id:'debito-uuid',fattura_id:'fattura-uuid',origine_debito:'fattura',importo_totale:100,importo_pagato:null,revisione_debito:4}
  const rpc=(name,args)=>{
    calls.push({name,args})
    const request=Promise.resolve(name==='leggi_debiti_fornitori'?{data:[debt]}:{error:{message:'Revisione obsoleta'}})
    return Object.assign(request,{abortSignal:()=>request})
  }
  const react={
    useState(initial){const i=index++;if(!(i in state)) state[i]=initial;return [state[i],v=>{state[i]=v}]},
    useRef(initial){const i=index++;if(!(i in state)) state[i]={current:initial};return state[i]},
    useCallback:fn=>fn,useEffect:fn=>effects.push(fn),
  }
  const jsx=(type,props)=>({type,props})
  const exports={}
  vm.runInNewContext(code,{exports,AbortController,require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:{supabase:{rpc}},FormData:class {get(k){return {scadenza:'2026-11-20',dovuto:'100',pagato:'20'}[k]}}})
  const render=()=>{index=0;return exports.default({cardStyle:{},fatturaId:'fattura-uuid'})}
  const flatten=x=>Array.isArray(x)?x.flatMap(flatten):x?.props?[x,...flatten(x.props.children)]:[x]
  render()
  effects[0]()
  await new Promise(resolve=>setImmediate(resolve))
  const tree=flatten(render())
  assert.ok(tree.includes('Sconosciuto'))
  assert.ok(tree.includes('Verifica scadenza e saldo'))
  assert.deepEqual(calls.map(c=>c.name),['leggi_debiti_fornitori'])
  assert.equal(calls[0].args.p_fattura,'fattura-uuid')
  await tree.find(n=>n?.type==='form').props.onSubmit({preventDefault(){},currentTarget:{},nativeEvent:{}})
  assert.equal(calls[1].name,'verifica_debito_fornitore')
  assert.equal(calls[1].args.p_id,'debito-uuid')
  assert.equal(calls[1].args.p_revisione,4)
  assert.equal(calls[1].args.p_pagato,'20')
  assert.ok(flatten(render()).includes('Revisione obsoleta'))
})
