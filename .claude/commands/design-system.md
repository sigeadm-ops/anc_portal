# Design System — Portal ANC

Consulte este documento antes de qualquer implementação visual. Ele é a fonte de verdade para cores, tipografia, componentes e variantes de tema do Portal ANC.

---

## 1. Paleta Global (Dark Theme — padrão de toda a aplicação)

| Token CSS        | Valor       | Uso                                      |
|------------------|-------------|------------------------------------------|
| `--bg0`          | `#070A1A`   | Fundo do body / camada mais profunda     |
| `--bg1`          | `#0B1030`   | Gradiente de fundo secundário            |
| `--card`         | `#0E163F`   | Fundo padrão de cards                    |
| `--card2`        | `#101B4D`   | Fundo alternativo de card                |
| `--line`         | `rgba(255,255,255,.10)` | Bordas e divisores             |
| `--text`         | `#FFFFFF`   | Texto principal                          |
| `--muted`        | `rgba(255,255,255,.70)` | Texto secundário/labels        |
| `--good`         | `#38F2A3`   | Sucesso / status OK                      |
| `--warn`         | `#FFD43B`   | Aviso                                    |
| `--bad`          | `#FF4D6D`   | Erro / danger                            |
| `--c1`           | `#7C3AED`   | Cor primária — **G148 Teen** (roxo)      |
| `--c2`           | `#22D3EE`   | Acento cyan (usado em stat-num, focus)   |
| `--c3`           | `#FB7185`   | Acento rosa                              |
| `--c4`           | `#A3E635`   | Acento verde-lima                        |
| `--c5`           | `#F97316`   | Acento laranja                           |

---

## 2. Paleta Soul+ (Tema âmbar — EXCLUSIVO para rotas Soul+)

| Token CSS                  | Valor                     | Uso                                |
|----------------------------|---------------------------|------------------------------------|
| `--soul-amber`             | `#FFF8E1`                 | Fundo âmbar claro (bg do tema)     |
| `--soul-amber-dark`        | `#FFECB3`                 | Âmbar escuro para gradientes       |
| `--soul-brown`             | `#3E2000` / `#8D5200`     | Texto principal no tema claro      |
| `--soul-chocolate`         | `#5D4037`                 | Texto secundário                   |
| `--soul-chocolate-intense` | `#281400`                 | Texto de alto contraste            |
| `--soul-accent`            | `#FF8F00`                 | Cor de ação principal Soul+ (âmbar)|

### Regra crítica: Aplicação do tema Soul+
O tema Soul+ **deve ser aplicado ao `.main-content`**, não a elementos filhos. O mecanismo correto está em `AppLayout.jsx`:

```javascript
const isSoul = location.pathname.startsWith('/soul')
            || location.pathname.startsWith('/admin/config/soul')
```

A classe `theme-soul` no `.main-content` ativa os seletores `.main-content.theme-soul` que definem:
- Fundo: gradiente âmbar quente (`#FFF9E6 → #FFE082`)
- Cards: `rgba(255, 248, 220, 0.92)` com borda laranja
- Inputs: fundo `rgba(40,20,0,0.05)`, texto `#281400`
- Botão primário: gradiente `#FFB300 → #FF8F00`
- Aba ativa (admin-tab-btn.active): `var(--soul-accent)` = `#FF8F00`

**Nunca use `--c1` (roxo) em contexto Soul+.** O roxo é exclusivo do G148 Teen.

---

## 3. Tipografia

| Propriedade   | Valor                                                  |
|---------------|--------------------------------------------------------|
| Família       | `"Space Grotesk"` (Google Fonts), fallback: `system-ui`|
| Token         | `var(--font)`                                          |
| Pesos usados  | 400, 500, 600, 700, 800                                |
| Títulos       | `font-weight: 800`, `letter-spacing: -.3px`            |
| Labels        | `font-size: 12px`, `font-weight: 600`, `color: var(--muted)` |
| Corpo         | `font-size: 13.5–14px`, `font-weight: 600`             |
| Badges/chips  | `font-size: 11px`, `font-weight: 700`                  |

---

## 4. Espaçamento e Raios de Borda

| Token          | Valor  | Aplicação                         |
|----------------|--------|-----------------------------------|
| `--radius`     | `16px` | Cards, modais, containers         |
| `--radius-sm`  | `10px` | Inputs, botões, chips, tabelas    |
| Padding card   | `15–20px` | Padrão de card-header/body     |
| Gap forms      | `14px` | Entre campos do `form-grid`       |
| Gap seções     | `24px` | Entre cards/seções de página      |
| Topbar height  | `70px` | `--topbar-h`                      |
| Sidebar width  | `260px` / `72px` collapsed        |

---

## 5. Componentes e Classes CSS

### Cards
```css
.card          /* container padrão */
.card-header   /* 15px 20px padding, flex, border-bottom */
.card-title    /* 14px, font-weight 800 */
.card-body     /* 20px padding */
.section       /* margin-bottom: 24px */
```

### Botões
```css
.btn           /* base — borda semi-transparente */
.btn-primary   /* gradiente c1→c2 (dark) / âmbar (Soul+) */
.btn-outline   /* fundo quase transparente */
.btn-danger    /* vermelho */
.btn-ghost     /* sem fundo nem borda */
.btn-sm        /* versão compacta (6px 11px) */
.btn-icon      /* ícone quadrado com borda */
.btn-icon.danger /* ícone destructivo vermelho */
```

### Chips / Badges
```css
.chip          /* base: border-radius 999px */
.chip-good     /* verde — #38F2A3 */
.chip-warn     /* amarelo — #FFD43B */
.chip-danger   /* vermelho — #FF4D6D */
.chip-info     /* cyan — #22D3EE */
.chip-muted    /* cinza transparente */
.chip-teen     /* roxo — G148 Teen */
.chip-soul     /* âmbar — Soul+ */
```

### Status Bar
```css
.status-bar        /* neutro */
.status-bar.ok     /* verde */
.status-bar.warn   /* amarelo */
.status-bar.err    /* vermelho */
```

### Abas Admin
```css
.admin-tabs-nav           /* container flex com wrap */
.admin-tab-btn            /* botão de aba */
.admin-tab-btn.active     /* ativa: var(--c1) no dark / var(--soul-accent) no Soul+ */
```

### Tabelas
```css
.table-wrap    /* scroll horizontal */
thead th       /* sticky, uppercase, 11px, var(--muted) */
tbody td       /* 13.5px, borda sutil */
.td-actions    /* flex de botões de ação */
.row-num       /* número de linha com estilo pill */
```

### Formulário
```css
.form-grid     /* grid auto-fill minmax(220px,1fr) */
.form-grid-2   /* 2 colunas */
.form-grid-3   /* 3 colunas */
.form-group    /* flex column gap 6px */
```

---

## 6. Sombras e Transições

| Token           | Valor                                    |
|-----------------|------------------------------------------|
| `--shadow`      | `0 18px 50px rgba(0,0,0,.45)`           |
| `--shadow-sm`   | `0 4px 20px rgba(0,0,0,.35)`            |
| `--transition`  | `.3s cubic-bezier(0.4, 0, 0.2, 1)`      |
| `--focus`       | `0 0 0 3px rgba(34,211,238,.25), 0 0 0 1px rgba(34,211,238,.35) inset` |
| Focus Soul+     | `border-color: #8D5200; box-shadow: 0 0 0 4px rgba(255,143,0,0.1)` |

---

## 7. Ícones e Emojis por Módulo

| Módulo           | Ícone  | Notas                                   |
|------------------|--------|-----------------------------------------|
| Dashboard        | 🏠     |                                         |
| Bases            | ⛪     |                                         |
| Membros          | 👥     |                                         |
| Notas            | 📋     |                                         |
| Desafios         | 🏅     |                                         |
| Ranking          | 🏆     |                                         |
| Relatórios       | 📊     |                                         |
| Config Geral     | ⚙️     |                                         |
| Config Soul+     | ☀️     | Âmbar — nunca usar ⚡ no Soul+          |
| Config Teen      | ⚡     | Roxo — exclusivo G148 Teen              |
| Provas           | 📝     |                                         |
| Discípulos       | 📖     |                                         |
| Trimestres       | 📅     |                                         |
| Regiões          | 🌍     |                                         |
| Distritos        | 📍     |                                         |
| Igrejas          | ⛪     |                                         |
| Diagnóstico      | 🛡️     |                                         |

---

## 8. Regras Invioláveis de Identidade Visual

1. **Roxo (`--c1: #7C3AED`) é exclusivo do G148 Teen.** Nunca aparece em contexto Soul+.
2. **Âmbar (`--soul-accent: #FF8F00`) é exclusivo do Soul+.** Nunca aparece em contexto Teen.
3. **O tema Soul+ requer `theme-soul` no `.main-content`.** Aplicar apenas em elemento filho não ativa o CSS completo.
4. **Inputs no Soul+ nunca têm fundo branco puro.** Usar `rgba(40,20,0,0.05)` para manter o contexto âmbar.
5. **Botão primário Soul+:** gradiente `#FFB300 → #FF8F00`, texto `#281400`. Nunca gradiente roxo-cyan.
6. **Fonte única:** Space Grotesk em todos os contextos. Não usar monospace exceto em blocos de código.
7. **Bordas de card Soul+:** `rgba(255,143,0,0.35)` — nunca `rgba(255,255,255,.10)` (seria invisível no fundo âmbar).

---

## 9. Estrutura de Rotas e Contexto de Tema

| Rota                     | Tema aplicado  | `isSoul` |
|--------------------------|----------------|----------|
| `/soul/*`                | Soul+ (âmbar)  | `true`   |
| `/admin/config/soul`     | Soul+ (âmbar)  | `true`   |
| `/teen/*`                | Dark (roxo)    | `false`  |
| `/admin/config/teen`     | Dark (roxo)    | `false`  |
| `/admin/config`          | Dark (roxo)    | `false`  |
| `/relatorios`            | Dark           | `false`  |

---

## 10. Checklist antes de implementar qualquer UI

- [ ] Estou no contexto Soul+ ou Teen?
- [ ] A classe `theme-soul` está no `.main-content` (não em elemento filho)?
- [ ] Usei `--soul-accent` / âmbar no Soul+ e `--c1` / roxo no Teen?
- [ ] Os chips para Soul+ usam `.chip-soul`, para Teen usam `.chip-teen`?
- [ ] Inputs no Soul+ têm `background: rgba(40,20,0,0.05)` e `color: #281400`?
- [ ] Ícone do módulo está correto (☀️ Soul+, ⚡ Teen)?
- [ ] `.btn-primary` no Soul+ vai exibir gradiente âmbar (via `.main-content.theme-soul .btn-primary`)?
