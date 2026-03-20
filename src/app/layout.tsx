import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Análisis de Estados de Cuenta | FCRCAN",
  description: "Sistema profesional para análisis de estado de cuenta bancarios. Extraiga y analice ingresos de forma segura.",
  keywords: ["estados de cuenta", "bancos", "análisis financiero", "Costa Rica", "PDF"],
  authors: [{ name: "FCRCAN" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-color: #f8fafc !important;
            color: #1e293b !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          }
          /* Force visible content */
          .min-h-screen {
            min-height: 100vh !important;
            display: flex !important;
          }
        `}} />
      </head>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        minHeight: '100vh',
        backgroundColor: '#f8fafc', 
        color: '#1e293b',
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
