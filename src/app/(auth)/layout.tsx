import { Box } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <Box className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            C&D Packaging
          </h1>
          <p className="mt-1 text-brand-200 text-sm">
            Packaging Production Tracking
          </p>
        </div>

        {/* Auth Card */}
        {children}
      </div>

      {/* Footer */}
      <footer className="pb-6 text-center">
        <p className="text-xs text-brand-300">
          Powered by{" "}
          <a
            href="https://cndprinting.com"
            className="underline underline-offset-2 hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            cndprinting.com
          </a>
        </p>
      </footer>
    </div>
  );
}
