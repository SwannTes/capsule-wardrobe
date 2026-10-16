import type { Metadata } from "next";
import Uploader from "@/components/Uploader";

export const metadata: Metadata = { title: "上传单品" };

export default function UploadPage() {
  return <Uploader />;
}
