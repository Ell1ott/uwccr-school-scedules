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
    <section className="rounded-[28px] bg-residential-container px-5 py-6 text-center text-on-residential-container">
      <p className="text-label-sm tracking-[0.14em] uppercase opacity-80">
        Gate pass
      </p>
      <p className="mt-1 text-title-md tracking-tight">{name}</p>
      <div className="mx-auto mt-4 w-full max-w-[240px] rounded-3xl bg-white p-3">
        <QRCodeSVG
          value={studentQrPayload(studentId)}
          size={240}
          level="H"
          bgColor="#ffffff"
          fgColor="#041627"
          className="h-auto w-full"
        />
      </div>
      <p className="mt-3 text-body-md opacity-80">
        Hold this to the camera at the gate.
      </p>
    </section>
  );
}
