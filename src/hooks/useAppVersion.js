import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'

const BUNDLE_HASH_KEY = 'app-bundle-hash'
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 min

async function fetchBundleHash() {
  try {
    const res = await fetch('/', { cache: 'no-store' })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/\/assets\/index-([^."]+)\.js/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function useAppVersion() {
  const notifiedRef = useRef(false)

  useEffect(() => {
    async function check() {
      if (notifiedRef.current) return
      const hash = await fetchBundleHash()
      if (!hash) return

      const stored = localStorage.getItem(BUNDLE_HASH_KEY)
      if (!stored) {
        localStorage.setItem(BUNDLE_HASH_KEY, hash)
        return
      }

      if (stored !== hash) {
        notifiedRef.current = true
        toast(
          (t) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>Nova versão disponível</span>
              <button
                onClick={() => {
                  localStorage.setItem(BUNDLE_HASH_KEY, hash)
                  window.location.reload()
                }}
                style={{
                  background: 'var(--c1, #7c3aed)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Atualizar
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
              >
                ✕
              </button>
            </span>
          ),
          { duration: Infinity, id: 'app-update' }
        )
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
}
