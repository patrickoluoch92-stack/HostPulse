import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseStorage } from './firebase';

export async function uploadImageToFirebaseStorage(
  file: File,
  pathPrefix = 'uploads',
): Promise<string> {
  if (!firebaseStorage) {
    throw new Error('Firebase Storage is not configured.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${pathPrefix}/${Date.now()}-${safeName}`;
  const storageRef = ref(firebaseStorage, objectPath);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  });
  return getDownloadURL(snapshot.ref);
}
