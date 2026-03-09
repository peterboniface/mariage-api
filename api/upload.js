import { google } from "googleapis";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  if (req.headers["x-upload-secret"] !== process.env.UPLOAD_SECRET) {
    return res.status(401).json({ error: "Clé secrète invalide" });
  }

  const busboy = await import("busboy").then(m => m.default);
  const bb = busboy({ headers: req.headers });

  const files = [];

  bb.on("file", (name, file, info) => {
    const { filename, mimeType } = info;

    const bufferChunks = [];
    file.on("data", (data) => bufferChunks.push(data));
    file.on("end", () => {
      files.push({
        filename,
        mimeType,
        buffer: Buffer.concat(bufferChunks),
      });
    });
  });
console.log("Requête reçue !");
  bb.on("finish", async () => {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      const drive = google.drive({ version: "v3", auth });

      for (const file of files) {
        await drive.files.create({
          requestBody: {
            name: `${Date.now()}-${file.filename}`,
            parents: [process.env.GOOGLE_FOLDER_ID],
          },
          media: {
            mimeType: file.mimeType,
            body: Buffer.from(file.buffer),
          },
        });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });

  req.pipe(bb);
}

