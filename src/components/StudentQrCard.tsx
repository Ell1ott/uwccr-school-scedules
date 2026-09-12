import { QRCodeSVG } from "qrcode.react";
import { studentQrPayload } from "../lib/gate";

export function StudentQrCard({
  studentId,
  name,
}: {
  studentId: string;
  name: string;
}) {
  return (
    <section className="reach-pass">
      <p className="reach-meta">Gate pass</p>
      <h2>{name}</h2>
      <QRCodeSVG
        value={studentQrPayload(studentId)}
        size={240}
        level="M"
        bgColor="#ffffff"
        fgColor="#1c1c1e"
      />
      <p>Hold this to the camera at the gate.</p>
    </section>
  );
}
