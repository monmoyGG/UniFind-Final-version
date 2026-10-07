import { useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { itemService } from "@/services/itemService";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Uploads one item photo and hands back the stored URL.
 *
 * The file goes to the backend immediately; SQLite only ever stores the URL,
 * never the image bytes.
 */
export function ImageUploader({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    // Checked here for fast feedback; the backend checks again before storing.
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Please choose an image smaller than 5MB.");
      return;
    }

    setUploading(true);
    try {
      const { url } = await itemService.uploadPhoto(file);
      onChange(url);
      toast.success("Photo attached.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="uploader recessed">
      {value ? (
        <div className="uploader-preview">
          <img src={value} alt="Uploaded item" />
          <div>
            <strong>Photo attached</strong>
            <span className="mono-label">READY TO SUBMIT</span>
          </div>
          <button
            type="button"
            className="icon-button danger"
            onClick={() => onChange(null)}
            aria-label="Remove photo"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <label className="uploader-drop">
          {uploading ? <Loader2 size={22} className="spin" /> : <ImagePlus size={22} />}
          <div>
            <strong>{uploading ? "Uploading…" : "Add a photo"}</strong>
            <span className="mono-label">JPG · PNG · WEBP · UP TO 5MB</span>
          </div>
          <input
            type="file"
            accept={ACCEPTED.join(",")}
            disabled={uploading}
            onChange={event => handleFile(event.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
