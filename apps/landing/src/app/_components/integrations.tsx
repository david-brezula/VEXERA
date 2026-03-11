import { cn } from "@/lib/utils";

const integrations = [
  { name: "Pohoda", color: "bg-blue-500" },
  { name: "Money S3", color: "bg-emerald-500" },
  { name: "KROS", color: "bg-orange-500" },
  { name: "Gmail", color: "bg-red-500" },
  { name: "Outlook", color: "bg-sky-500" },
  { name: "CSV / Excel", color: "bg-green-600" },
];

export function Integrations() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Kompatibilne s vasimi nastrojmi
          </h2>
          <p className="text-lg text-muted-foreground">
            Napojte Vexeru na existujuce uctovne systemy, email a bankove vypisy
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="bg-white rounded-xl border border-border p-6 flex flex-col items-center gap-3 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-default"
            >
              <div
                className={cn(
                  "w-12 h-12 rounded-xl text-white font-bold text-lg flex items-center justify-center",
                  integration.color
                )}
              >
                {integration.name[0]}
              </div>
              <span className="text-sm font-medium text-foreground">
                {integration.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
