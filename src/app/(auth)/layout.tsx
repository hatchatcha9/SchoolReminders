export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // AuthProvider is already provided by AppLayout
  return <>{children}</>;
}
