-- ================================================================
-- Bucket "anc-media": libera PDF para o comprovante do cartão de
-- discípulo. O bucket foi criado (20260423) aceitando só imagens,
-- então o upload de PDF falhava com
-- "mime type application/pdf is not supported".
-- ================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf'
]
WHERE id = 'anc-media';
