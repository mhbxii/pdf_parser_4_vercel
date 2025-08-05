import Busboy from "busboy";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const chunks = [];
    const busboy = Busboy({ headers: req.headers });

    let buffer;
    await new Promise((resolve, reject) => {
      busboy.on("file", (fieldname, file, info) => {
        if (info.mimeType !== "application/pdf") {
          return reject(new Error("Only PDF files allowed"));
        }
        file.on("data", (data) => chunks.push(data));
        file.on("end", () => {
          buffer = Buffer.concat(chunks);
        });
      });
      busboy.on("finish", resolve);
      busboy.on("error", reject);
      req.pipe(busboy);
    });

    if (!buffer) throw new Error("No file uploaded");
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large (max 5MB)" });
    }

    // pdfjs wants Uint8Array
    const pdfData = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdfDoc = await loadingTask.promise;

    if (pdfDoc.numPages > 5) {
      return res.status(400).json({ error: "PDF exceeds 5 pages" });
    }

    let text = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n\n";
    }

    text = text.trim();
    if (!text) return res.status(400).json({ error: "No text extracted" });
    if (text.length > 10000) text = text.slice(0, 10000);

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
