export const dynamic = "force-static";
export default function Offline() {
  return (
    <div className="container-app py-16 text-center">
      <h1 className="text-2xl font-bold">Estás sem internet</h1>
      <p className="mt-2 text-muted">Liga os dados ou o Wi-Fi e tenta outra vez.</p>
    </div>
  );
}
