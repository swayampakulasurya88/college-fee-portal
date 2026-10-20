/**
 * Reads an image file, centre-crops it to a square and downscales it so the
 * data URL stays small (256×256 JPEG ≈ 15–25 KB) before it is stored.
 */
export function readPhotoFile(file, size = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose an image first.'));
    if (!String(file.type || '').startsWith('image/')) {
      return reject(new Error('Please choose an image file (JPEG, PNG or WebP).'));
    }
    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error('That image is too big — please choose one under 8 MB.'));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        reject(new Error('Could not process that image.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

/** Round profile picture — the student's photo, or their initial as a fallback. */
export default function StudentAvatar({ student, size = 64 }) {
  const name = student?.name || '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const style = {
    width: size,
    height: size,
    flex: `0 0 ${size}px`,
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    background: 'var(--indigo-soft, #e0e7ff)',
    color: 'var(--indigo-dark, #3730a3)',
    fontWeight: 800,
    fontSize: Math.round(size * 0.42),
    border: '2px solid #fff',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.14)',
  };

  if (student?.photo) return <img src={student.photo} alt={name || 'Profile photo'} style={style} />;
  return (
    <div style={style} aria-label="No profile photo">
      {initial}
    </div>
  );
}
