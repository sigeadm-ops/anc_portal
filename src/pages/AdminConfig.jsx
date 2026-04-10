import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

export default function AdminConfig() {
  const { changePassword, logout } = useAuthStore()
  const [pwd, setPwd] = useState({ cur: '', novo: '', conf: '' })

  async function handleChangePwd(e) {
    e.preventDefault()
    if (!pwd.cur || !pwd.novo || !pwd.conf) { toast.error('Preencha todos os campos.'); return }
    if (pwd.novo !== pwd.conf) { toast.error('Nova senha e confirmação não coincidem.'); return }
    if (pwd.novo.length < 6) { toast.error('Nova senha deve ter ao menos 6 caracteres.'); return }
    const ok = await changePassword(pwd.cur, pwd.novo)
    if (ok) {
      toast.success('Senha alterada com sucesso!')
      setPwd({ cur: '', novo: '', conf: '' })
    } else {
      toast.error('Senha atual incorreta.')
    }
  }

  const appsScriptCode = `// Cole este código no seu Google Apps Script
function doGet(e) {
  const p = JSON.parse(e.parameter.d || '{}');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (p.action === 'ping') return json({ ok: true });
  
  const sheet = ss.getSheetByName(p.sheet);
  if (!sheet) return json({ ok: false, error: 'Sheet não encontrada: ' + p.sheet });
  
  if (p.action === 'get_all') {
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
    return json({ ok: true, data });
  }
  
  if (p.action === 'insert') {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map(h => p.data[h] ?? '');
    sheet.appendRow(row);
    return json({ ok: true });
  }
  
  if (p.action === 'update') {
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const idIdx = headers.indexOf('id');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] == p.data.id) {
        const newRow = headers.map(h => p.data[h] ?? rows[i][headers.indexOf(h)]);
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: 'Registro não encontrado' });
  }
  
  if (p.action === 'delete') {
    const rows = sheet.getDataRange().getValues();
    const idIdx = rows[0].indexOf('id');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] == p.data.id) {
        sheet.deleteRow(i + 1);
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: 'Registro não encontrado' });
  }
  
  return json({ ok: false, error: 'Ação não reconhecida: ' + p.action });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`

  return (
    <div>
      {/* Trocar senha */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">🔒 Alterar Senha Admin</div>
        </div>
        <form onSubmit={handleChangePwd}>
          <div className="form-grid" style={{ maxWidth: 480 }}>
            {[['cur','Senha atual','password'],['novo','Nova senha','password'],['conf','Confirmar nova senha','password']].map(([k,lbl,type]) => (
              <div key={k} className="form-group">
                <label>{lbl}</label>
                <input type={type} value={pwd[k]} onChange={e => setPwd(p => ({ ...p, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="submit" className="btn btn-primary">Alterar Senha</button>
            <button type="button" className="btn btn-danger" onClick={() => { if(confirm('Sair da área admin?')) logout() }}>Sair do Admin</button>
          </div>
        </form>
      </div>

      {/* Apps Script */}
      <div className="card section">
        <div className="card-header">
          <div className="card-title">📋 Apps Script — Espelhamento Sheets</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Cole este código no seu Google Apps Script para manter o espelhamento dos dados no Sheets.
        </p>
        <pre style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 16, fontSize: 12, overflowX: 'auto', lineHeight: 1.6,
          color: 'var(--text-primary)', fontFamily: 'monospace'
        }}>
          {appsScriptCode}
        </pre>
        <button
          className="btn btn-outline btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => { navigator.clipboard.writeText(appsScriptCode); toast.success('Código copiado!') }}
        >
          📋 Copiar código
        </button>
      </div>

      {/* Variáveis de ambiente */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚙️ Configuração do .env.local</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Crie o arquivo <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>.env.local</code> na raiz do projeto com estas variáveis:
        </p>
        <pre style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: 16, fontSize: 12, overflowX: 'auto', lineHeight: 1.8,
          color: 'var(--text-primary)', fontFamily: 'monospace'
        }}>
{`VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/SEU_SCRIPT/exec`}
        </pre>
      </div>
    </div>
  )
}
