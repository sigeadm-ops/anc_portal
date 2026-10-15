#!/usr/bin/env node
/**
 * Acerta as marcações automáticas semanais (Assiduidade / Cartão / Comunhão)
 * a partir das notas, com a mesma regra de db.syncDesafiosAdministrativosFromNotas:
 *   - Assiduidade: o sábado tem alguma nota lançada
 *   - Cartão: todas as notas do sábado com o cartão preenchido
 *   - Comunhão: alguma nota do sábado com Comunhão = Sim
 * Só MARCA o que falta — nunca desmarca. Bases de região travada são puladas.
 *
 * Uso (na raiz do projeto, lê .env.local):
 *   node scripts/corrigir-assiduidade-comunhao.mjs                     # simula, todas as regiões
 *   node scripts/corrigir-assiduidade-comunhao.mjs --regiao R03        # simula só a Oeste
 *   node scripts/corrigir-assiduidade-comunhao.mjs --aplicar           # grava
 *   opções: --ano 2026  --regiao <id_regiao>  --aplicar
 */

import fs from 'fs'

const args = process.argv.slice(2)
const arg = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : null }
const APLICAR = args.includes('--aplicar')
const ANO = Number(arg('--ano')) || new Date().getFullYear()
const REGIAO = arg('--regiao')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)).filter(Boolean).map(m => [m[1], m[2]])
)
const URL = `${env.VITE_SUPABASE_URL}/rest/v1/`
const KEY = env.VITE_SUPABASE_ANON_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function get(path) {
  let todos = [], from = 0
  while (true) {
    const r = await fetch(URL + path, { headers: { ...headers, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } })
    const j = await r.json()
    if (!Array.isArray(j)) throw new Error(`GET ${path}: ${JSON.stringify(j)}`)
    todos = todos.concat(j)
    if (j.length < 1000) return todos
    from += 1000
  }
}

async function upsertRegistros(linhas) {
  const r = await fetch(URL + 'desafios_registros?on_conflict=base_id,desafio_id,data_sabado', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(linhas),
  })
  if (!r.ok) throw new Error(`upsert: ${r.status} ${await r.text()}`)
}

// ── Regras (espelho de src/api/db.js e src/lib/desafiosPontuacao.js) ──
const isSimLike = v => ['sim', 's', 'true', '1', 'yes', 'x'].includes(String(v ?? '').trim().toLowerCase())
const respondido = v => v !== null && v !== undefined && String(v).trim() !== ''
const preencheCartao = n => [n.comunhao, n.verso, n.discipulado, n.trezentos_treinamento, n.trezentos_estudo].every(respondido)
const isAutoAdmin = c => ['admin', 'da'].includes(String(c ?? '').trim().toLowerCase())

function gerarSabados(primeiro, ultimo) {
  const s = []
  let d = new Date(primeiro + 'T12:00:00')
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  const fim = new Date(ultimo + 'T12:00:00')
  while (d <= fim) { s.push(d.toISOString().slice(0, 10)); d = new Date(d); d.setDate(d.getDate() + 7) }
  return s
}
const divisor = (desafio, sabados) => desafio.cadencia === 'mensal'
  ? new Set(sabados.map(s => s.slice(0, 7))).size || 1
  : sabados.length || 1

function travada(regiao, agora = new Date()) {
  if (!regiao?.bloqueio_lancamentos) return false
  return !regiao.bloqueio_inicio || agora >= new Date(regiao.bloqueio_inicio)
}

// ── Execução ──
const hoje = new Date().toISOString().slice(0, 10)
const [regioes, bases, catalogo, trimestres] = await Promise.all([
  get('Regiao?select=id_regiao,Regiao,bloqueio_lancamentos,bloqueio_inicio'),
  get('vw_bases?select=id_base,Base,Tipo,Status,id_regiao&order=id_base'),
  get('desafios_catalogo?select=*&ativo=eq.true&order=id'),
  get(`configuracao_trimestres?ano=eq.${ANO}&order=trimestre`),
])
const regiaoPorId = Object.fromEntries(regioes.map(r => [r.id_regiao, r]))

const sabadoInfo = {} // sábado -> sábados do trimestre (para o divisor)
trimestres.forEach(tc => {
  const s = gerarSabados(tc.primeiro_sabado, tc.ultimo_sabado)
  s.forEach(x => { sabadoInfo[x] = s })
})

function desafiosAutomaticos(tipo) {
  const isTeen = /teen/i.test(tipo)
  const doTipo = catalogo.filter(d => /teen/i.test(d.tipo || 'G148 Teen') === isTeen && isAutoAdmin(d.categoria) &&
    (d.periodicidade === 'semanal' || d.rastreamento === 'semanal'))
  return [
    ...doTipo.filter(d => /assiduidade|portal/i.test(d.nome ?? '')).map(d => ({ d, regra: 'assiduidade' })),
    ...doTipo.filter(d => /cart[aã]o/i.test(d.nome ?? '')).map(d => ({ d, regra: 'cartao' })),
    ...doTipo.filter(d => /comunh[aã]o/i.test(d.nome ?? '')).map(d => ({ d, regra: 'comunhao' })),
  ]
}

const notasCols = 'id,id_base,data,comunhao,verso,discipulado,trezentos_treinamento,trezentos_estudo'
const [notasTeen, notasSoul, registros] = await Promise.all([
  get(`vw_notas_teen?select=${notasCols}&order=id&data=gte.${ANO}-01-01&data=lte.${ANO}-12-31`),
  get(`vw_notas_soul?select=${notasCols}&order=id&data=gte.${ANO}-01-01&data=lte.${ANO}-12-31`),
  get(`desafios_registros?select=base_id,desafio_id,data_sabado,realizado&order=id&data_sabado=gte.${ANO}-01-01&data_sabado=lte.${ANO}-12-31`),
])
const notasPorBaseDia = {}
;[...notasTeen, ...notasSoul].forEach(n => {
  const k = `${n.id_base}|${String(n.data).slice(0, 10)}`
  ;(notasPorBaseDia[k] ??= []).push(n)
})
const realizado = new Set(registros.filter(r => r.realizado).map(r => `${r.base_id}|${r.desafio_id}|${r.data_sabado}`))

const resumo = []
const gravar = []
const puladas = new Set()

for (const base of bases) {
  if (REGIAO && base.id_regiao !== REGIAO) continue
  if (travada(regiaoPorId[base.id_regiao])) { puladas.add(regiaoPorId[base.id_regiao]?.Regiao ?? base.id_regiao); continue }
  const autos = desafiosAutomaticos(base.Tipo || 'G148 Teen')
  let pts = 0, n = 0
  for (const sabado of Object.keys(sabadoInfo)) {
    if (sabado > hoje) continue
    const notas = notasPorBaseDia[`${base.id_base}|${sabado}`] ?? []
    if (!notas.length) continue
    const ok = {
      assiduidade: true,
      cartao: notas.every(preencheCartao),
      comunhao: notas.some(x => isSimLike(x.comunhao)),
    }
    for (const { d, regra } of autos) {
      if (!ok[regra] || realizado.has(`${base.id_base}|${d.id}|${sabado}`)) continue
      n++
      pts += Number(d.pontos_total) / divisor(d, sabadoInfo[sabado])
      gravar.push({
        base_id: base.id_base, desafio_id: d.id, data_sabado: sabado, realizado: true, responsavel: null,
        obs: regra === 'comunhao' ? 'Automático via campo Comunhão nas notas'
          : regra === 'cartao' ? 'Automático via preenchimento das notas' : 'Automático via lançamento de notas',
      })
    }
  }
  if (n) resumo.push({ base: `${base.id_base} ${base.Base}`, tipo: base.Tipo, regiao: regiaoPorId[base.id_regiao]?.Regiao ?? base.id_regiao, marcacoes: n, pontos: Math.round(pts * 10) / 10 })
}

resumo.sort((a, b) => a.regiao.localeCompare(b.regiao) || b.pontos - a.pontos)
console.table(resumo)
console.log(`${resumo.length} bases, ${gravar.length} marcações a acrescentar.`)
if (puladas.size) console.log(`Puladas (região travada — congeladas): ${[...puladas].join(', ')}`)

if (!APLICAR) {
  console.log('\nSimulação — nada foi gravado. Rode com --aplicar para gravar.')
} else if (gravar.length) {
  // Cópia do estado anterior (linha existente ou null = não existia), pra desfazer se preciso
  const anteriores = registros.filter(r => gravar.some(g => g.base_id === r.base_id && g.desafio_id === r.desafio_id && g.data_sabado === r.data_sabado))
  const arqBackup = `backup-assiduidade-comunhao-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(arqBackup, JSON.stringify({ gravadas: gravar, anteriores }, null, 1))
  console.log(`Backup do estado anterior: ${arqBackup}`)
  for (let i = 0; i < gravar.length; i += 200) await upsertRegistros(gravar.slice(i, i + 200))
  console.log(`\n✅ ${gravar.length} marcações gravadas.`)
}
