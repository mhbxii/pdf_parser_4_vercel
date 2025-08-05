import Busboy from "busboy";
import pdf from "pdf-parse";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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

    // pdf-parse usage:
    const data = await pdf(buffer);

    // Check pages count limit:
    if (data.numpages > 5) {
      return res.status(400).json({ error: "PDF exceeds 5 pages" });
    }

    // Limit extracted text length:
    let text = data.text.trim();
    if (!text) return res.status(400).json({ error: "No text extracted" });
    if (text.length > 10000) text = text.slice(0, 10000);

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
