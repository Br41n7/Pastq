import VendorProvider from '@/components/vendor/VendorProvider';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return <VendorProvider>{children}</VendorProvider>;
}
