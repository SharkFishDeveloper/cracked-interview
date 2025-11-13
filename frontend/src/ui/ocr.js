
export async function runOCRRequest(imageBase64, abortSignal) {
  const res = await fetch("http://localhost:8080/ocr", {
    method: "POST",
    signal: abortSignal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  });

  const data = await res.json();
  return data?.text || "";
}
