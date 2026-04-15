/**
 * Upload one image for split-canvas admin; returns S3 filename from backend.
 */
export async function uploadSplitCanvasImageFile(file, token) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `${process.env.REACT_APP_BACKEND_URL}/uploadSplitCanvasImage`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || "Upload failed");
  }
  if (!json.success || !json.filename) {
    throw new Error("Invalid upload response");
  }
  return json.filename;
}
