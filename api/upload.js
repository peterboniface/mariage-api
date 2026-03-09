import { Storage } from "@google-cloud/storage";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    const storage = new Storage({
      projectId: process.env.GOOGLE_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY,
      },
    });

    const bucket = storage.bucket(process.env.GOOGLE_BUCKET_NAME);

    const fileName = `upload_${Date.now()}.mp4`;
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      resumable: false,
      contentType: "video/mp4",
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 jours
    });

    return res.status(200).json({
      message: "Upload réussi",
      fileName,
      url,
    });
  } catch (error) {
    console.error("Erreur upload:", error);
    return res.status(500).json({ error: "Erreur upload" });
  }
}
