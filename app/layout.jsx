import './globals.css';

export const metadata = {
  title: 'jevmail — terminal',
  description: 'Clasifica y archiva tu bandeja principal de Gmail',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
