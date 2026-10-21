export async function uploadLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Selecciona un archivo PNG, JPG o WebP.');
  }
  if (file.size > 4 * 1024 * 1024) throw new Error('El logo debe pesar menos de 4 MB.');
  const response = await fetch('/api/station/assets/logo', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.url !== 'string') {
    throw new Error(payload.error || `No se pudo subir el logo (${response.status}).`);
  }
  return payload.url;
}
